import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { privateProcedure, publicProcedure, router } from "./trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { z } from "zod";
import { INFINITE_QUERY_LIMIT } from "@/config/infinite-query";
import { getUserSubscriptionPlan, stripe } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/utils";
import { PLANS } from "@/config/stripe";
import { UTApi } from "uploadthing/server";

export const appRouter = router({
  authCallback: publicProcedure.query(async () => {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user || !user.id || !user.email)
      throw new TRPCError({ code: "UNAUTHORIZED" });

    const dbUser = await db.user.findFirst({
      where: {
        id: user.id,
      },
    });

    if (!dbUser) {
      // first time user is using the app, create in db
      await db.user.create({
        data: {
          id: user.id,
          email: user.email,
        },
      });
    }

    return { success: true };
  }),
  getUserFiles: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    return await db.file.findMany({
      where: {
        userId,
      },
    });
  }),
  getFile: privateProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      // check if file in db
      const file = await db.file.findFirst({
        where: {
          key: input.key,
          userId,
        },
      });

      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      return file;
    }),
  deleteFile: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      const file = await db.file.findFirst({
        where: {
          id: input.id,
          userId,
        },
      });

      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      // delete from transcript table
      const transcript = await db.transcript.findFirst({
        where: {
          fileId: file.id
        }
      })

      if(transcript) {
        await db.transcript.delete({
          where: {
            id: transcript.id,
            fileId: file.id
          }
        })
      }
      
      // delete from db
      await db.file.delete({
        where: {
          id: input.id,
        },
      });


      // delete from uploadthing
      const utapi = new UTApi({
        fetch: globalThis.fetch,
        apiKey: process.env.UPLOADTHING_SECRET
      })
      await utapi.deleteFiles(file.key)


      return file;
    }),
  getFileUploadStatus: privateProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const file = await db.file.findFirst({
        where: {
          id: input.fileId,
          userId: ctx.userId,
        },
      });

      if (!file) return { status: "PENDING" as const };

      return { status: file.uploadStatus };
    }),
  getFileMessages: privateProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.string().nullish(), // used for infinite query, where to start searching new messages
        fileId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { fileId, cursor } = input;
      const limit = input.limit ?? INFINITE_QUERY_LIMIT;

      const file = await db.file.findFirst({
        where: {
          id: fileId,
          userId,
        },
      });

      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      // now fetch messages in this file
      const messages = await db.message.findMany({
        take: limit + 1, // the + 1 is for where the cursor is
        where: {
          fileId,
        },
        orderBy: {
          createdAt: "desc",
        },
        cursor: cursor ? { id: cursor } : undefined,
        select: {
          id: true,
          isUserMessage: true,
          createdAt: true,
          text: true,
        },
      });

      // determine logic for next cursor
      let nextCursor: typeof cursor | undefined = undefined;

      if (messages.length > limit) {
        const nextItem = messages.pop(); // out + 1 from the take
        nextCursor = nextItem?.id;
      }

      return {
        messages,
        nextCursor,
      };
    }),
    createStripeSession: privateProcedure.mutation(
      async ({ ctx }) => {
        const { userId } = ctx
  
        const billingUrl = absoluteUrl('/dashboard/billing')
  
        if (!userId)
          throw new TRPCError({ code: 'UNAUTHORIZED' })
  
        const dbUser = await db.user.findFirst({
          where: {
            id: userId,
          },
        })
  
        if (!dbUser)
          throw new TRPCError({ code: 'UNAUTHORIZED' })
  
        const subscriptionPlan =
          await getUserSubscriptionPlan()
  
        if (
          subscriptionPlan.isSubscribed &&
          dbUser.stripeCustomerId
        ) {
          const stripeSession =
            await stripe.billingPortal.sessions.create({
              customer: dbUser.stripeCustomerId,
              return_url: billingUrl,
            })
  
          return { url: stripeSession.url }
        }
  
        const stripeSession =
          await stripe.checkout.sessions.create({
            success_url: billingUrl,
            cancel_url: billingUrl,
            payment_method_types: ['card', 'paypal'],
            mode: 'subscription',
            billing_address_collection: 'auto',
            line_items: [
              {
                price: PLANS.find(
                  (plan) => plan.name === 'Pro'
                )?.price.priceIds.test,
                quantity: 1,
              },
            ],
            metadata: {
              userId: userId,
            },
          })
  
        return { url: stripeSession.url }
      }
    ),
});

export type AppRouter = typeof appRouter;
