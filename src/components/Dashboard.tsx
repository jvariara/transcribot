"use client";
import { trpc } from "@/app/_trpc/client";
import UploadButton from "./UploadButton";
import {
  Check,
  Ghost,
  Loader2,
  MessageSquare,
  Plus,
  Trash,
  XIcon,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "./ui/button";
import { useState } from "react";
import { getUserSubscriptionPlan } from "@/lib/stripe";

interface PageProps {
  subscriptionPlan: Awaited<ReturnType<typeof getUserSubscriptionPlan>>;
}

const Dashboard = ({ subscriptionPlan }: PageProps) => {
  const [currentlyDeletingFile, setCurrentlyDeletingFile] = useState<
    string | null
  >(null);
  const utils = trpc.useUtils();

  const { data: files, isLoading } = trpc.getUserFiles.useQuery();

  const { mutate: deleteFile } = trpc.deleteFile.useMutation({
    onSuccess: () => {
      utils.getUserFiles.invalidate();
    },
    onMutate({ id }) {
      setCurrentlyDeletingFile(id);
    },
    onSettled() {
      setCurrentlyDeletingFile(null);
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 xl:px-0 md:p-10">
      <div className="mt-8 flex flex-col items-start justify-between gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:gap-0">
        <h1 className="mb-3 font-bold text-5xl text-gray-900">My Files</h1>

        {/* Upload Button */}
        <UploadButton isSubscribed={subscriptionPlan.isSubscribed} />
      </div>

      {files && files?.length !== 0 ? (
        <ul className="mt-8 grid grid-cols-1 gap-6 divide-y divide-zinc-200 md:grid-cols-2 lg:grid-cols-3">
          {files
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .map((file) => (
              <li
                key={file.id}
                className="col-span-1 dividy-y divide-gray-200 rounded-lg bg-white shadow transition hover:shadow-lg"
              >
                <Link
                  href={`/dashboard/${file.id}`}
                  className="flex flex-col gap-2"
                >
                  <div className="pt-6 px-6 flex w-full items-center justify-between space-x-6">
                    <div
                      aria-hidden="true"
                      className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-r from-lime-500 to-green-500"
                    />
                    <div className="flex-1 truncate">
                      <div className="flex items-center space-x-3">
                        <h3 className="truncate text-lg font-medium text-zinc-900">
                          {file.name}
                        </h3>
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="px-6 mt-4 grid grid-cols-3 place-items-center py-2 gap-6 text-xs text-zinc-500 border-t border-t-gray-300">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    {format(new Date(file.createdAt), "MMM dd yyyy")}
                  </div>
                  <div className="flex items-center gap-2">
                    {file.uploadStatus === "SUCCESS" && (
                      <>
                        <Check className="h-4 w-4 text-green-500" />
                        {file.uploadStatus}
                      </>
                    )}
                    {file.uploadStatus === "FAILED" && (
                      <>
                        <XIcon className="h-4 w-4 text-red-500" />
                        {file.uploadStatus}
                      </>
                    )}
                    {file.uploadStatus === "PROCESSING" ||
                      (file.uploadStatus === "PENDING" && (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {file.uploadStatus}
                        </>
                      ))}
                  </div>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={() => deleteFile({ id: file.id })}
                  >
                    {currentlyDeletingFile === file.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
        </ul>
      ) : isLoading ? (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton height={100} className="my-2 col-span-1" count={1} />
          <Skeleton height={100} className="my-2 col-span-1" count={1} />
          <Skeleton height={100} className="my-2 col-span-1" count={1} />
        </div>
      ) : (
        <div className="mt-16 flex flex-col items-center gap-2">
          <Ghost className="h-8 w-8 text-zinc-800" />
          <h3 className="font-semibold text-xl">Pretty empty around here</h3>
          <p>Let&apos;s upload your first file.</p>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
