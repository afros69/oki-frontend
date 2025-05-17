import { v4 as uuidv4 } from "uuid";
import { useUserContext } from "@/contexts/UserContext";
import {
  isArtifactCodeContent,
  isArtifactMarkdownContent,
  isDeprecatedArtifactType,
} from "@opencanvas/shared/utils/artifacts";
import { reverseCleanContent } from "@/lib/normalize_string";
import {
  ArtifactCodeV3, ArtifactMarkdownV3,
  ArtifactType,
  ArtifactV3,
  CustomModelConfig,
  GraphInput,
  ProgrammingLanguageOptions,
  RewriteArtifactMetaToolResponse,
  SearchResult,
  TextHighlight,
} from "@opencanvas/shared/types";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { useRuns } from "@/hooks/useRuns";
import { createClient } from "@/hooks/utils";
import { WEB_SEARCH_RESULTS_QUERY_PARAM } from "@/constants";
import {
  DEFAULT_INPUTS,
  OC_WEB_SEARCH_RESULTS_MESSAGE_KEY,
} from "@opencanvas/shared/constants";
import {
  ALL_MODEL_NAMES,
  NON_STREAMING_TEXT_MODELS,
  NON_STREAMING_TOOL_CALLING_MODELS,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_MODEL_NAME,
} from "@opencanvas/shared/models";
import { Thread } from "@langchain/langgraph-sdk";
import { useToast } from "@/hooks/use-toast";
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  convertToArtifactV3,
  extractChunkFields,
  handleGenerateArtifactToolCallChunk,
  removeCodeBlockFormatting,
  replaceOrInsertMessageChunk,
  updateHighlightedCode,
  updateHighlightedMarkdown,
  updateRewrittenArtifact,
} from "./utils";
import {
  handleRewriteArtifactThinkingModel,
  isThinkingModel,
} from "@opencanvas/shared/utils/thinking";
import { debounce } from "lodash";
import { useThreadContext } from "./ThreadProvider";
import { useAssistantContext } from "./AssistantContext";
import { StreamWorkerService } from "@/workers/graph-stream/streamWorker";
import { useQueryState } from "nuqs";

interface GraphData {
  runId: string | undefined;
  isStreaming: boolean;
  error: boolean;
  selectedBlocks: TextHighlight | undefined;
  messages: BaseMessage[];
  artifact: ArtifactV3 | undefined;
  updateRenderedArtifactRequired: boolean;
  isArtifactSaved: boolean;
  firstTokenReceived: boolean;
  feedbackSubmitted: boolean;
  artifactUpdateFailed: boolean;
  chatStarted: boolean;
  searchEnabled: boolean;
  setSearchEnabled: Dispatch<SetStateAction<boolean>>;
  setChatStarted: Dispatch<SetStateAction<boolean>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  setFeedbackSubmitted: Dispatch<SetStateAction<boolean>>;
  setArtifact: Dispatch<SetStateAction<ArtifactV3 | undefined>>;
  setSelectedBlocks: Dispatch<SetStateAction<TextHighlight | undefined>>;
  setSelectedArtifact: (index: number) => void;
  setMessages: Dispatch<SetStateAction<BaseMessage[]>>;
  streamMessage: (params: GraphInput) => Promise<void>;
  setArtifactContent: (index: number, content: string) => void;
  clearState: () => void;
  switchSelectedThread: (thread: Thread) => void;
  setUpdateRenderedArtifactRequired: Dispatch<SetStateAction<boolean>>;
}

type GraphContentType = {
  graphData: GraphData;
};

const GraphContext = createContext<GraphContentType | undefined>(undefined);

// Shim for recent LangGraph bugfix
function extractStreamDataChunk(chunk: any) {
  if (Array.isArray(chunk)) {
    return chunk[1];
  }
  return chunk;
}

function extractStreamDataOutput(output: any) {
  if (Array.isArray(output)) {
    return output[1];
  }
  return output;
}

export function GraphProvider({ children }: { children: ReactNode }) {
  const artifactContent: ArtifactCodeV3 | ArtifactMarkdownV3 = {
    index: 1,
    type: "text",
    title: `Quick start text`,
    fullMarkdown: "",
  };

  const newArtifact: ArtifactV3 = {
    currentIndex: 1,
    contents: [artifactContent],
  };


  const userData = useUserContext();
  const assistantsData = useAssistantContext();
  const threadData = useThreadContext();
  const { toast } = useToast();
  const { shareRun } = useRuns();
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<BaseMessage[]>([]);
  const [artifact, setArtifact] = useState<ArtifactV3>(
      // newArtifact
  );
  const [selectedBlocks, setSelectedBlocks] = useState<TextHighlight>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [updateRenderedArtifactRequired, setUpdateRenderedArtifactRequired] =
    useState(false);
  const lastSavedArtifact = useRef<ArtifactV3 | undefined>(undefined);
  const debouncedAPIUpdate = useRef(
    debounce(
      (artifact: ArtifactV3, threadId: string) =>
        updateArtifact(artifact, threadId),
      5000
    )
  ).current;
  const [isArtifactSaved, setIsArtifactSaved] = useState(true);
  const [threadSwitched, setThreadSwitched] = useState(false);
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const [runId, setRunId] = useState<string>();
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const [artifactUpdateFailed, setArtifactUpdateFailed] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);

  const [_, setWebSearchResultsId] = useQueryState(
    WEB_SEARCH_RESULTS_QUERY_PARAM
  );

  // useEffect(() => {
  //   if (typeof window === "undefined" || !userData.user) return;
  //
  //   // Get or create a new assistant if there isn't one set in state, and we're not
  //   // loading all assistants already.
  //   if (
  //     !assistantsData.selectedAssistant &&
  //     !assistantsData.isLoadingAllAssistants
  //   ) {
  //     assistantsData.getOrCreateAssistant(userData.user.id);
  //   }
  // }, [userData.user]);

  // Very hacky way of ensuring updateState is not called when a thread is switched
  useEffect(() => {
    if (threadSwitched) {
      const timer = setTimeout(() => {
        setThreadSwitched(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [threadSwitched]);

  useEffect(() => {
    return () => {
      debouncedAPIUpdate.cancel();
    };
  }, [debouncedAPIUpdate]);

  useEffect(() => {
    if (!threadData.threadId) return;
    if (!messages.length || !artifact) return;
    if (updateRenderedArtifactRequired || threadSwitched || isStreaming) return;
    const currentIndex = artifact.currentIndex;
    const currentContent = artifact.contents.find(
      (c) => c.index === currentIndex
    );
    if (!currentContent) return;
    if (
      (artifact.contents.length === 1 &&
        artifact.contents[0].type === "text" &&
        !artifact.contents[0].fullMarkdown) ||
      (artifact.contents[0].type === "code" && !artifact.contents[0].code)
    ) {
      // If the artifact has only one content and it's empty, we shouldn't update the state
      return;
    }

    if (
      !lastSavedArtifact.current ||
      lastSavedArtifact.current.contents !== artifact.contents
    ) {
      setIsArtifactSaved(false);
      // This means the artifact in state does not match the last saved artifact
      // We need to update
      debouncedAPIUpdate(artifact, threadData.threadId);
    }
  }, [artifact, threadData.threadId]);

  const searchOrCreateEffectRan = useRef(false);

  // Attempt to load the thread if an ID is present in query params.
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !userData.user ||
      threadData.createThreadLoading ||
      !threadData.threadId
    ) {
      return;
    }

    // Only run effect once in development
    if (searchOrCreateEffectRan.current) {
      return;
    }
    searchOrCreateEffectRan.current = true;

    threadData.getThread(threadData.threadId).then((thread) => {
      if (thread) {
        switchSelectedThread(thread);
        return;
      }

      // Failed to fetch thread. Remove from query params
      threadData.setThreadId(null);
    });
  }, [threadData.threadId, userData.user]);

  const updateArtifact = async (
    artifactToUpdate: ArtifactV3,
    threadId: string
  ) => {
    setArtifactUpdateFailed(false);
    if (isStreaming) return;

    try {
      const client = createClient();
      await client.threads.updateState(threadId, {
        values: {
          artifact: artifactToUpdate,
        },
      });
      setIsArtifactSaved(true);
      lastSavedArtifact.current = artifactToUpdate;
    } catch (_) {
      setArtifactUpdateFailed(true);
    }
  };

  const clearState = () => {
    setMessages([]);
    setArtifact(undefined);
    setFirstTokenReceived(true);
  };

  const streamMessageV2 = async (params: GraphInput) => {
    const newMessageText = params.messages[0]!.content
    console.log(`Current thread: ${threadData.threadId}`)
    setFirstTokenReceived(false);
    setError(false);

    // TODO: send new message text to backend
    // TODO: add ai response new message list
    // TODO: if there is markdown - set new artifact and update the ui

    console.log(artifact)

    setMessages((prev) => {
      return [
        ...prev,
        new AIMessage({
          id: `fhfhfhf-${uuidv4()}`,
          content: "Ответ справа",
        }),
      ];
    });

    const artifactContent: ArtifactCodeV3 | ArtifactMarkdownV3 = {
      index: 1,
      type: "text",
      title: artifact!.contents[0]!.title,
      fullMarkdown: "Ответ"
    };

    const newArtifact: ArtifactV3 = {
      currentIndex: 1,
      contents: [artifactContent],
    };
    setArtifact(newArtifact);
    setUpdateRenderedArtifactRequired(true)

    let currentThreadId = threadData.threadId;
    console.log(`Current thread: ${currentThreadId}`)
    if (!currentThreadId) {
      currentThreadId = uuidv4();
    }

    // setIsStreaming(true); TODO: set for loading
    setRunId(undefined);
    setFeedbackSubmitted(false);
    // The root level run ID of this stream
    let runId = "";
    let followupMessageId = "";
    // The ID of the message containing the thinking content.
    let thinkingMessageId = "";
  };

  const setSelectedArtifact = (index: number) => {
    setUpdateRenderedArtifactRequired(true);
    setThreadSwitched(true);

    setArtifact((prev) => {
      if (!prev) {
        toast({
          title: "Error",
          description: "No artifactV2 found",
          variant: "destructive",
          duration: 5000,
        });
        return prev;
      }
      const newArtifact = {
        ...prev,
        currentIndex: index,
      };
      lastSavedArtifact.current = newArtifact;
      return newArtifact;
    });
  };

  const setArtifactContent = (index: number, content: string) => {
    setArtifact((prev) => {
      if (!prev) {
        toast({
          title: "Error",
          description: "No artifact found",
          variant: "destructive",
          duration: 5000,
        });
        return prev;
      }
      const newArtifact = {
        ...prev,
        currentIndex: index,
        contents: prev.contents.map((a) => {
          if (a.index === index && a.type === "code") {
            return {
              ...a,
              code: reverseCleanContent(content),
            };
          }
          return a;
        }),
      };
      return newArtifact;
    });
  };

  const switchSelectedThread = (thread: Thread) => {
    setUpdateRenderedArtifactRequired(true);
    setThreadSwitched(true);
    setChatStarted(true);

    // Set the thread ID in state. Then set in cookies so a new thread
    // isn't created on page load if one already exists.
    threadData.setThreadId(thread.thread_id);

    // Set the model name and config
    if (thread.metadata?.customModelName) {
      threadData.setModelName(
        thread.metadata.customModelName as ALL_MODEL_NAMES
      );
      threadData.setModelConfig(
        thread.metadata.customModelName as ALL_MODEL_NAMES,
        thread.metadata.modelConfig as CustomModelConfig
      );
    } else {
      threadData.setModelName(DEFAULT_MODEL_NAME);
      threadData.setModelConfig(DEFAULT_MODEL_NAME, DEFAULT_MODEL_CONFIG);
    }

    const castValues: {
      artifact: ArtifactV3 | undefined;
      messages: Record<string, any>[] | undefined;
    } = {
      artifact: undefined,
      messages: (thread.values as Record<string, any>)?.messages || undefined,
    };
    const castThreadValues = thread.values as Record<string, any>;
    if (castThreadValues?.artifact) {
      if (isDeprecatedArtifactType(castThreadValues.artifact)) {
        castValues.artifact = convertToArtifactV3(castThreadValues.artifact);
      } else {
        castValues.artifact = castThreadValues.artifact;
      }
    } else {
      castValues.artifact = undefined;
    }
    lastSavedArtifact.current = castValues?.artifact;

    if (!castValues?.messages?.length) {
      setMessages([]);
      setArtifact(castValues?.artifact);
      return;
    }
    setArtifact(castValues?.artifact);
    setMessages(
      castValues.messages.map((msg: Record<string, any>) => {
        if (msg.response_metadata?.langSmithRunURL) {
          msg.tool_calls = msg.tool_calls ?? [];
          msg.tool_calls.push({
            name: "langsmith_tool_ui",
            args: { sharedRunURL: msg.response_metadata.langSmithRunURL },
            id: msg.response_metadata.langSmithRunURL
              ?.split("https://smith.langchain.com/public/")[1]
              .split("/")[0],
          });
        }
        return msg as BaseMessage;
      })
    );
  };

  const contextValue: GraphContentType = {
    graphData: {
      runId,
      isStreaming,
      error,
      selectedBlocks,
      messages,
      artifact,
      updateRenderedArtifactRequired,
      isArtifactSaved,
      firstTokenReceived,
      feedbackSubmitted,
      chatStarted,
      artifactUpdateFailed,
      searchEnabled,
      setSearchEnabled,
      setChatStarted,
      setIsStreaming,
      setFeedbackSubmitted,
      setArtifact,
      setSelectedBlocks,
      setSelectedArtifact,
      setMessages,
      streamMessage: streamMessageV2,
      setArtifactContent,
      clearState,
      switchSelectedThread,
      setUpdateRenderedArtifactRequired,
    },
  };

  return (
    <GraphContext.Provider value={contextValue}>
      {children}
    </GraphContext.Provider>
  );
}

export function useGraphContext() {
  const context = useContext(GraphContext);
  if (context === undefined) {
    throw new Error("useGraphContext must be used within a GraphProvider");
  }
  return context;
}
