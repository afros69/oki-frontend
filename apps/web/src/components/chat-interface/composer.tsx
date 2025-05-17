"use client";

import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { type FC, useState, useEffect } from "react";

import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { SendHorizontalIcon } from "lucide-react";
import { DragAndDropWrapper } from "./drag-drop-wrapper";
import { ComposerAttachments } from "../assistant-ui/attachment";
import { ComposerActionsPopOut } from "./composer-actions-popout";

const GENERIC_PLACEHOLDERS = [
  "Опишите, какой документ вам нужен, и мы его подготовим",
  "Какой договор или юридический документ вы хотите создать?",
  "Начните вводить детали вашего контракта, и мы его оформим",
  "Опишите условия договора, и OkiDoki сделает все остальное",
  "Какой юридический документ вам нужен сегодня?",
  "Введите параметры вашего соглашения, и мы его сгенерируем",
  "Опишите ваши требования к документу, и он будет готов",
  "Начните писать ваш запрос, и OkiDoki подготовит документ",
  "Какой тип контракта или акта вам необходим?",
  "Давайте создадим юридический документ – введите ваши условия",
];

const SEARCH_PLACEHOLDERS = [
  "Share your topic - I'll add live data",
  "Write about anything - I'll find sources",
  "Your idea + fresh research = great content",
  "Start here with real-time facts",
  "Topic here for data-rich content",
  "Create with current insights",
  "Write now with live sources",
  "Your story + fresh data",
  "Ideas welcome - research ready",
  "Start fresh with live facts",
];

const getRandomPlaceholder = (searchEnabled: boolean) => {
  return searchEnabled
    ? SEARCH_PLACEHOLDERS[
        Math.floor(Math.random() * SEARCH_PLACEHOLDERS.length)
      ]
    : GENERIC_PLACEHOLDERS[
        Math.floor(Math.random() * GENERIC_PLACEHOLDERS.length)
      ];
};

const CircleStopIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      width="16"
      height="16"
    >
      <rect width="10" height="10" x="3" y="3" rx="2" />
    </svg>
  );
};

interface ComposerProps {
  chatStarted: boolean;
  userId: string | undefined;
  searchEnabled: boolean;
}

export const Composer: FC<ComposerProps> = (props: ComposerProps) => {
  const [placeholder, setPlaceholder] = useState("");

  useEffect(() => {
    setPlaceholder(getRandomPlaceholder(props.searchEnabled));
  }, [props.searchEnabled]);

  return (
    <DragAndDropWrapper>
      <ComposerPrimitive.Root className="focus-within:border-aui-ring/20 flex flex-col w-full min-h-[64px] flex-wrap items-center justify-center border px-2.5 shadow-sm transition-colors ease-in bg-white rounded-2xl">
        <div className="flex flex-wrap gap-2 items-start mr-auto">
          <ComposerAttachments />
        </div>

        <div className="flex flex-row w-full items-center justify-start my-auto">
          {/*<ComposerActionsPopOut*/}
          {/*  userId={props.userId}*/}
          {/*  chatStarted={props.chatStarted}*/}
          {/*/>*/}
          <ComposerPrimitive.Input
            autoFocus
            placeholder={placeholder}
            rows={1}
            className="placeholder:text-muted-foreground max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed"
          />
          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send asChild>
              <TooltipIconButton
                onClick={() => console.log('HERER')}
                tooltip="Send"
                variant="default"
                className="my-2.5 size-8 p-2 transition-opacity ease-in"
              >
                <SendHorizontalIcon />
              </TooltipIconButton>
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>
          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel asChild>
              <TooltipIconButton
                tooltip="Cancel"
                variant="default"
                className="my-2.5 size-8 p-2 transition-opacity ease-in"
              >
                <CircleStopIcon />
              </TooltipIconButton>
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>
        </div>
      </ComposerPrimitive.Root>
    </DragAndDropWrapper>
  );
};
