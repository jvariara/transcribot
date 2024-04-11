"use client";
import { PauseCircle, PlayCircle, SkipBack, SkipForward } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

interface AudioRendererProps {
  name: string;
  url: string;
}

const AudioRenderer = ({ name, url }: AudioRendererProps) => {
  const [audioProgress, setAudioProgress] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioTotalLength, setAudioTotalLength] = useState("00:00");
  const [audioCurrentTime, setAudioCurrentTime] = useState("00:00");
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAudioProgressBar = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      setAudioProgress(parseInt(e.target.value));
      audioRef.current.currentTime =
        (e.target.valueAsNumber * audioRef.current.duration) / 100;
    }
  };

  const handleAudioPlay = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        setIsAudioPlaying(true);
      } else {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      }
    }
  };

  const handleAudioUpdate = () => {
    if (audioRef.current) {
      // audio total time
      let minutes = Math.floor(audioRef.current.duration / 60);
      let seconds = Math.floor(audioRef.current.duration % 60);
      let totalLength = `${minutes < 10 ? `0${minutes}` : minutes}:${
        seconds < 10 ? `0${seconds}` : seconds
      }`;
      setAudioTotalLength(totalLength);

      // audio current time
      minutes = Math.floor(audioRef.current.currentTime / 60);
      seconds = Math.floor(audioRef.current.currentTime % 60);
      let currentTime = `${minutes < 10 ? `0${minutes}` : minutes}:${
        seconds < 10 ? `0${seconds}` : seconds
      }`;
      setAudioCurrentTime(currentTime);

      const progress = parseInt(
        (
          (audioRef.current.currentTime / audioRef.current.duration) *
          100
        ).toString()
      );
      setAudioProgress(progress);
    }
  };

  return (
    <div className="flex items-center justify-center mx-auto h-full w-full">
      <audio
        src={url}
        ref={audioRef}
        onEnded={() => {}}
        onTimeUpdate={handleAudioUpdate}
      />

      <div className="bg-gradient-to-tr from-lime-500 to-primary p-8 rounded-lg w-full xl:w-[600px] flex flex-col justify-center items-center text-center shadow-md font-semibold text-primary-foreground">
        <p className="mb-2 text-zinc-200">Audio Player</p>
        <p className="mx-auto text-xl md:text-2xl font-bold text-center mb-6 mt-2 truncate w-full">
          {name}
        </p>
        <div className="flex justify-between w-full">
          <p>{audioCurrentTime}</p>
          <p>{audioTotalLength}</p>
        </div>
        <input
          type="range"
          name="audioProgressBar"
          value={audioProgress}
          onChange={handleAudioProgressBar}
          className="w-full mb-4 mt-2 h-2.5 rounded-sm outline-none"
        />
        {!isAudioPlaying ? (
          <PlayCircle
            className="h-8 w-8 cursor-pointer"
            onClick={handleAudioPlay}
          />
        ) : (
          <PauseCircle
            className="h-8 w-8 cursor-pointer"
            onClick={handleAudioPlay}
          />
        )}
      </div>
    </div>
  );
};

export default AudioRenderer;
