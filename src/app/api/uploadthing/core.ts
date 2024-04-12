import { PLANS } from "@/config/stripe";
import { db } from "@/db";
import { openai } from "@/lib/openai";
import { getUserSubscriptionPlan } from "@/lib/stripe";
import { transcriber } from "@/lib/transcriber";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import * as mm from 'music-metadata'
import fs from "fs"
import fetch from "node-fetch"
 
const f = createUploadthing();

async function getAudioDurationFromURL(url: string) {
  try {
      // Download the audio file
      const response = await fetch(url);
      const buffer = await response.buffer();

      // Write the downloaded buffer to a temporary file
      const tempFilePath = './temp_audio.mp3'; // You may want to use a unique filename
      fs.writeFileSync(tempFilePath, buffer);

      // Extract duration from the temporary file
      const metadata = await mm.parseFile(tempFilePath);
      const duration = metadata.format.duration;

      // Remove the temporary file
      fs.unlinkSync(tempFilePath);

      return duration;
  } catch (error: any) {
      console.error('Error getting audio duration:', error.message);
      return null;
  }
}


const middleware = async() => {
  // This code runs on your server before upload
  const {getUser} = getKindeServerSession()
  const user = await getUser() 

  if(!user || !user.id) throw new Error("Unauthorized")

  const subscriptionPlan = await getUserSubscriptionPlan()
  // returns to the metadata in onUploadComplete
  return { userId: user.id, subscriptionPlan };
}

const onUploadComplete = async({metadata, file}: {
  metadata: Awaited<ReturnType<typeof middleware>>
  file: {
    key: string
    name: string
    url: string
  }}) => {
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
      // get subscription plan of user
      const {subscriptionPlan} = metadata
      const {isSubscribed} = subscriptionPlan

      // Load the audio file 
      const audioDuration = await getAudioDurationFromURL(file.url)

      const isFreeExceeded = (audioDuration! / 60) > PLANS.find((plan) => plan.name === "Free")!.minutesPerMP3
      const isProExceeded = (audioDuration! / 60) > PLANS.find((plan) => plan.name === "Pro")!.minutesPerMP3

      // do they exceed their limit, either pro or free
      if((isSubscribed && isProExceeded) || (!isSubscribed && isFreeExceeded)) {
        await db.file.update({
          data: {
            uploadStatus: "FAILED"
          },
          where: {
            id: createdFile.id
          }
        })
        return
      }

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
      console.log("ERRORRRR ", error)
      await db.file.update({
        where: {
          id: createdFile.id
        },
        data: {
          uploadStatus: "FAILED"
        }
      })
    }
  }
 
 
export const ourFileRouter = {
  freePlanUploader: f({ audio: {maxFileSize: "8MB", maxFileCount: 1} } )
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
  proPlanUploader: f({ audio: {maxFileSize: "32MB", maxFileCount: 1} } )
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;