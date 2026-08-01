import { Plus, RefreshCw, User as UserIcon, LogOut, Shield, Sparkles } from "lucide-react";
import { SampleMenu } from "./SampleMenu";
import { ImportExportMenu } from "./ImportExportMenu";
import { ModeToggle } from "./ModeToggle";
import { UsageBadge } from "./UsageBadge";
import type { Sample, TtsSample } from "@/lib/samples";
import type { ProjectMode } from "@/types/models";
import type { User, Subscription, UsageInfo } from "@/lib/auth";
import { focusRing } from "@/lib/theme";

interface Props {
  validCount: number;
  cachedCount: number;
  busy: boolean;
  isDark: boolean;
  mode: ProjectMode | null;
  onModeChange: (m: ProjectMode) => void;
  onAddSegment: () => void;
  onGenerateAll: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onLoadPodcastSample: (sample: Sample) => void;
  onLoadTtsSample: (sample: TtsSample) => void;
  onExportSubtitles: () => void;
  subtitlesDisabled: boolean;
  // Auth & Subscriptions
  user: User | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  subscription: Subscription | null;
  usage: UsageInfo | null;
  onOpenAuth: () => void;
  onOpenSubscription: () => void;
  onOpenAccount: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

export function MiddleToolbar({
  validCount,
  cachedCount,
  busy,
  isDark,
  mode,
  onModeChange,
  onAddSegment,
  onGenerateAll,
  onExportJson,
  onImportJson,
  onLoadPodcastSample,
  onLoadTtsSample,
  onExportSubtitles,
  subtitlesDisabled,
  user,
  isLoggedIn,
  isAdmin,
  subscription,
  usage,
  onOpenAuth,
  onOpenSubscription,
  onOpenAccount,
  onOpenAdmin,
  onLogout,
}: Props) {
  const generateDisabled = busy || cachedCount === validCount;
  const isPodcast = mode === "podcast";
  const iconBtn = isDark ? "hover:bg-zinc-800 text-zinc-300" : "hover:bg-gray-100 text-gray-700";

  return (
    <div
      className={`flex items-center justify-between gap-2 @[1200px]:gap-3 p-2.5 @[1200px]:p-2.5 border-b flex-wrap ${
        isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center gap-3">
        {mode !== null && (
          <ModeToggle isDark={isDark} mode={mode} onChange={onModeChange} />
        )}
        {isPodcast && (
          <button
            type="button"
            onClick={onAddSegment}
            disabled={busy}
            title="Add a new segment"
            className={`flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 text-white disabled:text-zinc-400 rounded-lg font-medium text-sm transition-colors disabled:cursor-not-allowed ${focusRing}`}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden @[1100px]:inline">Add Segment</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Usage Badge / Subscription Upgrade */}
        {isLoggedIn && usage && (
          <UsageBadge
            subscription={subscription}
            usage={usage}
            onUpgradeClick={onOpenSubscription}
            isDark={isDark}
          />
        )}

        {isPodcast && (
          <button
            type="button"
            onClick={onGenerateAll}
            disabled={generateDisabled}
            title={`Generate all uncached segments (${cachedCount}/${validCount} done)`}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-colors disabled:cursor-not-allowed ${
              generateDisabled
                ? isDark
                  ? "bg-zinc-800 text-zinc-400"
                  : "bg-gray-100 text-gray-600"
                : "bg-orange-600 hover:bg-orange-500 text-white"
            } ${focusRing}`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden @[1100px]:inline">Generate All</span>
            {validCount > 0 && (
              <span
                className={`text-xs ml-1 ${
                  cachedCount === validCount ? "text-orange-100" : "text-white"
                }`}
              >
                {cachedCount}/{validCount}
              </span>
            )}
          </button>
        )}

        <ImportExportMenu
          isDark={isDark}
          busy={busy}
          onExportJson={onExportJson}
          onImportJson={onImportJson}
          onExportSubtitles={mode === "transcribe" || mode === "dub" ? undefined : onExportSubtitles}
          subtitlesDisabled={subtitlesDisabled}
        />

        {(mode === "podcast" || mode === "tts") && (
          <SampleMenu
            isDark={isDark}
            mode={mode}
            onLoadPodcast={onLoadPodcastSample}
            onLoadTts={onLoadTtsSample}
          />
        )}

        {/* Admin Console Button */}
        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="px-2.5 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 font-semibold text-xs flex items-center gap-1.5 transition-all"
            title="Open Admin Approval Console"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        )}

        {/* Auth Sign In / User Profile Button */}
        {!isLoggedIn ? (
          <button
            onClick={onOpenAuth}
            className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-md shadow-orange-500/20"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAccount}
              className={`p-1.5 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700" : "bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200"
              }`}
              title="Click to view My Account details"
            >
              <UserIcon className="w-3.5 h-3.5 text-orange-400" />
              <span className="max-w-[120px] truncate">{user?.full_name || user?.email.split("@")[0]}</span>
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm"
              title="Sign Out / Logout of your account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
