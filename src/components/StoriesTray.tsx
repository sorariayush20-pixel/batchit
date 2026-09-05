import React from 'react';
import { User, Story, UserStoryGroup } from '../types';
import { Plus, Globe, Lock, Sparkles, Clock } from 'lucide-react';

interface StoriesTrayProps {
  currentUser: User;
  userStoryGroups: UserStoryGroup[];
  onOpenCreateStory: () => void;
  onOpenStoryViewer: (groupIndex: number) => void;
}

export const StoriesTray: React.FC<StoriesTrayProps> = ({
  currentUser,
  userStoryGroups,
  onOpenCreateStory,
  onOpenStoryViewer,
}) => {
  // Find current user's story group
  const currentUserGroupIndex = userStoryGroups.findIndex((g) => g.isCurrentUser);
  const currentUserGroup = currentUserGroupIndex !== -1 ? userStoryGroups[currentUserGroupIndex] : null;
  const hasOwnStory = Boolean(currentUserGroup && currentUserGroup.stories.length > 0);

  // Other users' story groups
  const otherGroups = userStoryGroups
    .map((g, originalIndex) => ({ group: g, originalIndex }))
    .filter(({ group }) => !group.isCurrentUser);

  return (
    <div className="border-b border-slate-800/80 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Stories</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            24h
          </span>
        </div>
        <button
          onClick={onOpenCreateStory}
          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
        >
          <Plus className="w-3 h-3" />
          <span>Add Story</span>
        </button>
      </div>

      {/* Horizontal Stories Carousel */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 px-1 custom-scrollbar">
        {/* 1. "Your Story" Item */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
          <div className="relative">
            {hasOwnStory ? (
              /* User has active story: glowing emerald ring */
              <div
                onClick={() => onOpenStoryViewer(currentUserGroupIndex)}
                className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-500 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition"
              >
                <div className="w-full h-full rounded-full bg-slate-950 p-[2px]">
                  <img
                    src={
                      currentUser.avatarUrl ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`
                    }
                    alt={currentUser.username}
                    className="w-full h-full rounded-full object-cover bg-slate-800"
                  />
                </div>
              </div>
            ) : (
              /* User has no active story: normal avatar with + button */
              <div
                onClick={onOpenCreateStory}
                className="w-14 h-14 rounded-full p-[2px] border border-dashed border-slate-700 hover:border-emerald-500/60 group-hover:scale-105 transition"
              >
                <img
                  src={
                    currentUser.avatarUrl ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`
                  }
                  alt={currentUser.username}
                  className="w-full h-full rounded-full object-cover bg-slate-800"
                />
              </div>
            )}

            {/* Plus Icon Overlay */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateStory();
              }}
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg border-2 border-slate-950 hover:bg-emerald-400 hover:scale-110 transition"
              title="Add Story"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          </div>
          <span className="text-[11px] font-medium text-slate-300 max-w-[58px] truncate">
            {hasOwnStory ? 'Your Story' : 'Add Story'}
          </span>
        </div>

        {/* 2. Other Users' Stories */}
        {otherGroups.map(({ group, originalIndex }) => {
          const isSelectedOnly = group.stories.some((s) => s.privacy === 'selected');

          return (
            <div
              key={group.username}
              onClick={() => onOpenStoryViewer(originalIndex)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
            >
              <div className="relative">
                {/* Gradient Story Ring */}
                <div
                  className={`w-14 h-14 rounded-full p-[2.5px] group-hover:scale-105 transition shadow-sm ${
                    group.hasUnseenStories
                      ? isSelectedOnly
                        ? 'bg-gradient-to-tr from-teal-400 via-cyan-400 to-indigo-500 shadow-teal-500/20'
                        : 'bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-500 shadow-emerald-500/20'
                      : 'bg-slate-700/80 opacity-70'
                  }`}
                >
                  <div className="w-full h-full rounded-full bg-slate-950 p-[2px]">
                    <img
                      src={
                        group.userAvatar ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${group.username}`
                      }
                      alt={group.username}
                      className="w-full h-full rounded-full object-cover bg-slate-800"
                    />
                  </div>
                </div>

                {/* Privacy Badge if private/selected */}
                {isSelectedOnly && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center border-2 border-slate-950 text-[8px]"
                    title="Shared with selected contacts"
                  >
                    <Lock className="w-2.5 h-2.5" />
                  </div>
                )}
              </div>
              <span className="text-[11px] font-medium text-slate-300 max-w-[58px] truncate">
                @{group.username}
              </span>
            </div>
          );
        })}

        {/* Empty state hint if no other stories */}
        {otherGroups.length === 0 && (
          <div className="flex items-center pl-2 pr-4 text-[11px] text-slate-500 whitespace-nowrap">
            <span>No active stories from contacts</span>
          </div>
        )}
      </div>
    </div>
  );
};
