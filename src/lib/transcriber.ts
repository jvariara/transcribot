import { AssemblyAI } from 'assemblyai'

export const transcriber = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY!
})