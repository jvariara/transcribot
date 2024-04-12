import AudioRenderer from "@/components/AudioRenderer";
import ChatWrapper from "@/components/chat/ChatWrapper";
import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: {
    fileId: string;
  };
}

const Page = async ({ params }: PageProps) => {
  const { fileId } = params;

  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user || !user.id) redirect(`/auth-callback?origin=dashboard/${fileId}`);

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId: user.id,
    },
  }); 

  if (!file) return notFound();

  return (
    <div className="flex-1 justify-between flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="mx-auto w-full max-w-8xl grow lg:flex xl:px-2">
        {/* left side */}
        <div className="flex-1 flex">
          <div className="px-4 py-6 sm:px-6 lg:pl-8 flex-1 xl:pl-6">
            <AudioRenderer name={file.name} url={file.url}  />
          </div> 
        </div>

        {/* right side / chat box */}
        <div className="shrink-0 flex-[0.75] border-t border-gray-200 lg:w-96 lg:border-l lg:border-t-0">
            <ChatWrapper fileId={fileId} />
        </div>
      </div>
    </div>
  );
};

export default Page;
