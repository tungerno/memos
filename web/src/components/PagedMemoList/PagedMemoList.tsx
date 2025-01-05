import { Button } from "@usememos/mui";
import { ArrowDownIcon, LoaderIcon } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import PullToRefresh from "react-simple-pull-to-refresh";
import ScrollToTop from "@/components/ScrollToTop";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { Routes } from "@/router";
import { useMemoList, useMemoStore } from "@/store/v1";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import Empty from "../Empty";

interface Props {
  renderer: (memo: Memo) => JSX.Element;
  listSort?: (list: Memo[]) => Memo[];
  filter?: string;
  pageSize?: number;
}

interface State {
  isRequesting: boolean;
  nextPageToken: string;
}

const PagedMemoList = (props: Props) => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerRightOffset, setContainerRightOffset] = useState(0);
  const [state, setState] = useState<State>({
    isRequesting: true, // Initial request
    nextPageToken: "",
  });
  const sortedMemoList = props.listSort ? props.listSort(memoList.value) : memoList.value;
  const location = useLocation();

  const shouldShowScrollToTop = useMemo(
    () => [Routes.ROOT, Routes.EXPLORE, Routes.ARCHIVED].includes(location.pathname as Routes) || location.pathname.startsWith("/u/"),
    [location.pathname],
  );

  useEffect(() => {
    const updateOffset = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const offset = window.innerWidth - rect.right;
        setContainerRightOffset(offset);
      }
    };

    updateOffset();
    window.addEventListener("resize", updateOffset);
    return () => window.removeEventListener("resize", updateOffset);
  }, []);

  const fetchMoreMemos = async (nextPageToken: string) => {
    setState((state) => ({ ...state, isRequesting: true }));
    const response = await memoStore.fetchMemos({
      filter: props.filter || "",
      pageSize: props.pageSize || DEFAULT_LIST_MEMOS_PAGE_SIZE,
      pageToken: nextPageToken,
    });
    setState(() => ({
      isRequesting: false,
      nextPageToken: response?.nextPageToken || "",
    }));
  };

  const refreshList = async () => {
    memoList.reset();
    setState((state) => ({ ...state, nextPageToken: "" }));
    fetchMoreMemos("");
  };

  useEffect(() => {
    refreshList();
  }, [props.filter, props.pageSize]);

  const children = (
    <div ref={containerRef} className="flex flex-col justify-start items-start w-full max-w-full">
      {sortedMemoList.map((memo) => props.renderer(memo))}
      {state.isRequesting && (
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="animate-spin text-zinc-500" />
        </div>
      )}
      {!state.isRequesting && state.nextPageToken && (
        <div className="w-full flex flex-row justify-center items-center my-4">
          <Button variant="plain" onClick={() => fetchMoreMemos(state.nextPageToken)}>
            {t("memo.load-more")}
            <ArrowDownIcon className="ml-2 w-4 h-auto" />
          </Button>
        </div>
      )}
      {!state.isRequesting && !state.nextPageToken && sortedMemoList.length === 0 && (
        <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
          <Empty />
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
        </div>
      )}
      <ScrollToTop enabled={shouldShowScrollToTop} className="fixed bottom-6" style={{ right: `calc(1rem + ${containerRightOffset}px)` }} />
    </div>
  );

  // In case of md screen, we don't need pull to refresh.
  if (md) {
    return children;
  }

  return (
    <PullToRefresh
      onRefresh={() => refreshList()}
      pullingContent={
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="opacity-60" />
        </div>
      }
      refreshingContent={
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="animate-spin" />
        </div>
      }
    >
      {children}
    </PullToRefresh>
  );
};

export default PagedMemoList;
