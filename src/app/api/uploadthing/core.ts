import { db } from "@/db";
import { openai } from "@/lib/openai";
import { transcriber } from "@/lib/transcriber";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import fs from "fs";
 
const f = createUploadthing();
 
 
export const ourFileRouter = {
  audioUploader: f({ audio: {maxFileSize: "8MB", maxFileCount: 1} } )
    .middleware(async ({ req }) => {

    const {getUser} = getKindeServerSession()
    const user = getUser()
        
      if (!user || !user.id) throw new Error("Unauthorized");
        
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
        const isFileExist = await db.file.findFirst({
          where: {
            key: file.key
          }
        })
      
        if(isFileExist) return

        const createdFile = await db.file.create({
            data: {
                key: file.key,
                name: file.name,
                userId: metadata.userId,
                url: file.url,
                uploadStatus: "PROCESSING"
            }
        })

        
        try {
          // transcribe the mp3 file
          const transcript = await transcriber.transcripts.transcribe({
            audio: file.url,
          }, {
            pollingInterval: 1000,
            pollingTimeout: 180000
          })
          // const transcript = await openai.audio.transcriptions.create({
          //   file: file.url,
          //   model: "whisper-1",
          // })

          console.log(transcript)

          await db.transcript.create({
            data: {
              text: transcript.text as string,
              fileId: createdFile.id,
              userId: metadata.userId
            }
          })

          await db.file.update({
            data: {
              uploadStatus: 'SUCCESS',
            },
            where: {
              id: createdFile.id,
            },
          })
        } catch (error) {
          await db.file.update({
            where: {
              id: createdFile.id
            },
            data: {
              uploadStatus: "FAILED"
            }
          })
        }
    }),
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;