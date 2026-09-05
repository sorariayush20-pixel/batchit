import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import {
  Heart,
  MessageCircle,
  Share2,
  Image as ImageIcon,
  Send,
  Trash2,
  Tag,
  Users,
  Sparkles,
  Flame,
  Search,
  X,
  Plus,
  Loader2,
  Check,
  UserCheck,
  UserPlus,
  MessageSquare,
  Globe,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { User, Post, PostComment } from '../types';

interface PostsFeedProps {
  currentUser: User | null;
  socket: Socket | null;
  onOpenProfile?: (username: string) => void;
  onOpenFollowModal?: (username: string, type: 'followers' | 'following') => void;
  onStartChat?: (username: string) => void;
  onBack?: () => void;
}

export const PostsFeed: React.FC<PostsFeedProps> = ({
  currentUser,
  socket,
  onOpenProfile,
  onOpenFollowModal,
  onStartChat,
  onBack,
}) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'following' | 'my'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Post Creator State
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [tags, setTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMediaInput, setShowMediaInput] = useState(false);

  // Card interactions
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Popular quick tags
  const POPULAR_TAGS = ['updates', 'e2ee', 'privacy', 'security', 'tech', 'community'];

  // Fetch posts from socket or REST
  const fetchPosts = React.useCallback(() => {
    if (!socket) return;
    setLoading(true);

    const filterParam = filter === 'my' ? 'user' : filter;
    const targetUname = filter === 'my' ? currentUser?.username : undefined;

    socket.emit('post:list', { filter: filterParam, targetUsername: targetUname }, (res: Post[]) => {
      setLoading(false);
      if (Array.isArray(res)) {
        setPosts(res);
      }
    });
  }, [socket, filter, currentUser?.username]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Real-time Socket Event Handlers for Posts
  useEffect(() => {
    if (!socket) return;

    const handlePostCreated = (newPost: Post) => {
      setPosts((prev) => {
        if (prev.some((p) => p.id === newPost.id)) return prev;
        return [newPost, ...prev];
      });
    };

    const handlePostUpdated = (updatedPost: Post) => {
      setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    };

    const handlePostDeleted = ({ postId }: { postId: string }) => {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    };

    socket.on('post:created', handlePostCreated);
    socket.on('post:updated', handlePostUpdated);
    socket.on('post:deleted', handlePostDeleted);

    return () => {
      socket.off('post:created', handlePostCreated);
      socket.off('post:updated', handlePostUpdated);
      socket.off('post:deleted', handlePostDeleted);
    };
  }, [socket]);

  // Handle Image File Upload (converts to data URL preview/upload)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Media size exceeds 15MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setMediaUrl(reader.result as string);
      setMediaType(file.type.startsWith('video') ? 'video' : 'image');
      setShowMediaInput(true);
    };
    reader.readAsDataURL(file);
  };

  // Add a Tag to Creator
  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#/, '').toLowerCase();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setCustomTagInput('');
  };

  // Remove Tag from Creator
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Submit New Post
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !currentUser || isSubmitting) return;

    if (!content.trim() && !mediaUrl) {
      return;
    }

    setIsSubmitting(true);
    socket.emit(
      'post:create',
      {
        content: content.trim(),
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaUrl ? mediaType : undefined,
        tags,
      },
      (res: any) => {
        setIsSubmitting(false);
        if (res?.success) {
          setContent('');
          setMediaUrl('');
          setTags([]);
          setShowMediaInput(false);
        } else {
          alert(res?.error || 'Failed to publish post.');
        }
      }
    );
  };

  // Toggle Post Like
  const handleToggleLike = (postId: string) => {
    if (!socket || !currentUser) return;

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isLiked = p.likes.includes(currentUser.username);
          const newLikes = isLiked
            ? p.likes.filter((u) => u !== currentUser.username)
            : [...p.likes, currentUser.username];
          return { ...p, likes: newLikes };
        }
        return p;
      })
    );

    socket.emit('post:like:toggle', { postId });
  };

  // Toggle Comment Thread Expand
  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  // Add Comment
  const handleAddComment = (postId: string) => {
    if (!socket || !currentUser) return;
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;

    setCommentSubmitting((prev) => ({ ...prev, [postId]: true }));
    socket.emit('post:comment:add', { postId, text }, (res: any) => {
      setCommentSubmitting((prev) => ({ ...prev, [postId]: false }));
      if (res?.success) {
        setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      }
    });
  };

  // Delete Comment
  const handleDeleteComment = (postId: string, commentId: string) => {
    if (!socket || !currentUser) return;
    socket.emit('post:comment:delete', { postId, commentId });
  };

  // Delete Post
  const handleDeletePost = (postId: string) => {
    if (!socket || !currentUser) return;
    if (confirm('Are you sure you want to delete this post?')) {
      socket.emit('post:delete', { postId });
    }
  };

  // Toggle Follow User
  const handleToggleFollow = (targetUname: string, currentIsFollowing: boolean) => {
    if (!socket || !currentUser || followLoading[targetUname]) return;

    setFollowLoading((prev) => ({ ...prev, [targetUname]: true }));
    const event = currentIsFollowing ? 'unfollow:user' : 'follow:user';

    socket.emit(event, { targetUsername: targetUname }, (res: any) => {
      setFollowLoading((prev) => ({ ...prev, [targetUname]: false }));
      if (res?.success && filter === 'following' && currentIsFollowing) {
        // If on following tab and unfollowed, refresh feed
        fetchPosts();
      }
    });
  };

  // Copy Post Link
  const handleCopyPost = (post: Post) => {
    const text = `Post by @${post.username} on Batchit: "${post.content}"`;
    navigator.clipboard.writeText(text);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format Relative Time
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  // Filtered posts calculation
  const filteredPosts = posts.filter((p) => {
    if (selectedTag && (!p.tags || !p.tags.map((t) => t.toLowerCase()).includes(selectedTag.toLowerCase()))) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const contentMatch = p.content.toLowerCase().includes(q);
      const userMatch = p.username.toLowerCase().includes(q);
      const tagMatch = p.tags?.some((t) => t.toLowerCase().includes(q));
      if (!contentMatch && !userMatch && !tagMatch) return false;
    }
    return true;
  });

  return (
    <div id="posts-feed-container" className="flex-1 h-full overflow-y-auto bg-slate-950 text-slate-100 flex flex-col">
      {/* Feed Navigation Topbar */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-slate-900/85 border-b border-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-2">
          {onBack && (
            <button
              id="feed-back-btn"
              onClick={onBack}
              className="md:hidden p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors mr-1"
              title="Back to Chats"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <Flame className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Community Feed</h2>
        </div>

        {/* View Tabs */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            id="feed-tab-all"
            onClick={() => {
              setFilter('all');
              setSelectedTag(null);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'all'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Explore</span>
          </button>

          <button
            id="feed-tab-following"
            onClick={() => {
              setFilter('following');
              setSelectedTag(null);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'following'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Following</span>
          </button>

          <button
            id="feed-tab-my"
            onClick={() => {
              setFilter('my');
              setSelectedTag(null);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'my'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>My Posts</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            id="feed-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts or #tags..."
            className="w-full pl-8 pr-7 py-1.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Feed Container */}
      <div className="max-w-2xl w-full mx-auto p-4 space-y-5 flex-1">
        {/* Post Creation Box */}
        {currentUser && (
          <div
            id="post-creator-card"
            className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-xl shadow-black/30 transition-all hover:border-slate-700/80"
          >
            <form onSubmit={handleCreatePost}>
              <div className="flex items-start space-x-3">
                <img
                  src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`}
                  alt={currentUser.username}
                  className="w-10 h-10 rounded-full border border-slate-700 object-cover bg-slate-800 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <textarea
                    id="post-content-input"
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Share what's happening or discuss tech with the Batchit community..."
                    className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none"
                  />

                  {/* Media Preview Box */}
                  {mediaUrl && (
                    <div className="relative mt-2 rounded-xl overflow-hidden border border-slate-700 max-h-60 bg-black/40 group">
                      {mediaType === 'video' ? (
                        <video src={mediaUrl} controls className="w-full h-auto max-h-60 object-cover" />
                      ) : (
                        <img src={mediaUrl} alt="Upload preview" className="w-full h-auto max-h-60 object-cover" />
                      )}
                      <button
                        type="button"
                        id="remove-media-btn"
                        onClick={() => {
                          setMediaUrl('');
                          setShowMediaInput(false);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/70 text-slate-300 hover:text-rose-400 rounded-full backdrop-blur-sm transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Manual Media URL Input Modal/Bar */}
                  {showMediaInput && !mediaUrl && (
                    <div className="mt-2 p-2 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Paste image or video link (https://...)"
                        onChange={(e) => setMediaUrl(e.target.value)}
                        className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMediaInput(false)}
                        className="text-xs text-slate-400 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Active Tags Pills */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        >
                          <span>#{t}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="hover:text-emerald-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Creator Tools Footer */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/70">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      {/* Media Upload Button */}
                      <button
                        type="button"
                        id="upload-image-btn"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center space-x-1 px-2.5 py-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 rounded-lg text-xs transition-colors"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Photo/Video</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />

                      {/* URL Attachment Button */}
                      <button
                        type="button"
                        onClick={() => setShowMediaInput((prev) => !prev)}
                        className="flex items-center space-x-1 px-2.5 py-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 rounded-lg text-xs transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="hidden sm:inline">URL</span>
                      </button>

                      {/* Tag Input Pill */}
                      <div className="flex items-center bg-slate-800/50 rounded-lg px-2 py-1 border border-slate-700/50">
                        <Tag className="w-3.5 h-3.5 text-slate-400 mr-1" />
                        <input
                          type="text"
                          value={customTagInput}
                          onChange={(e) => setCustomTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag(customTagInput);
                            }
                          }}
                          placeholder="tag + Enter"
                          className="bg-transparent text-xs text-slate-200 placeholder-slate-500 w-20 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Publish Post Button */}
                    <button
                      type="submit"
                      id="publish-post-btn"
                      disabled={isSubmitting || (!content.trim() && !mediaUrl)}
                      className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Post</span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Popular Hashtags Filter Row */}
        <div className="flex items-center space-x-2 overflow-x-auto py-1 no-scrollbar text-xs">
          <span className="text-slate-500 font-medium whitespace-nowrap flex items-center">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Topics:
          </span>
          {selectedTag && (
            <button
              onClick={() => setSelectedTag(null)}
              className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1 whitespace-nowrap"
            >
              <span>#{selectedTag}</span>
              <X className="w-3 h-3 ml-1" />
            </button>
          )}
          {POPULAR_TAGS.map((t) => {
            if (selectedTag === t) return null;
            return (
              <button
                key={t}
                onClick={() => setSelectedTag(t)}
                className="px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/80 transition-colors whitespace-nowrap"
              >
                #{t}
              </button>
            );
          })}
        </div>

        {/* Feed List Items */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
            <p className="text-xs">Loading community posts...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-500">
              <Flame className="w-6 h-6 opacity-40" />
            </div>
            <h4 className="text-base font-semibold text-slate-200">
              {filter === 'following'
                ? 'No posts from people you follow yet'
                : filter === 'my'
                ? 'You have not shared any posts yet'
                : 'No posts found'}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm">
              {filter === 'following'
                ? 'Explore the global feed and follow other creators and friends to see their updates here!'
                : 'Be the first to share an update, thought, or media with the Batchit community!'}
            </p>
            {filter === 'following' && (
              <button
                onClick={() => setFilter('all')}
                className="px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold hover:bg-emerald-500/30 transition-all"
              >
                Switch to Explore Feed
              </button>
            )}
          </div>
        ) : (
          filteredPosts.map((post) => {
            const isSelf = currentUser?.username.toLowerCase() === post.username.toLowerCase();
            const isLiked = currentUser ? post.likes.includes(currentUser.username) : false;
            const isCommentsOpen = expandedComments.has(post.id);
            const canDelete = isSelf || currentUser?.username.toLowerCase() === 'batchit';

            return (
              <article
                key={post.id}
                id={`post-card-${post.id}`}
                className="bg-slate-900 border border-slate-800/90 rounded-2xl overflow-hidden shadow-lg shadow-black/20 hover:border-slate-700/70 transition-all"
              >
                {/* Post Author Header */}
                <div className="p-4 flex items-center justify-between border-b border-slate-800/50">
                  <div className="flex items-center space-x-3 min-w-0">
                    <button
                      onClick={() => onOpenProfile?.(post.username)}
                      className="flex-shrink-0 group"
                    >
                      <img
                        src={post.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.username}`}
                        alt={post.username}
                        className="w-10 h-10 rounded-full border border-slate-700 group-hover:border-emerald-500/60 object-cover bg-slate-800 transition-colors"
                      />
                    </button>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => onOpenProfile?.(post.username)}
                          className="text-sm font-semibold text-slate-200 hover:text-emerald-400 transition-colors truncate"
                        >
                          @{post.username}
                        </button>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-slate-800 text-slate-400 rounded-md">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">{formatTime(post.createdAt)}</p>
                    </div>
                  </div>

                  {/* Header Actions: Follow button & Delete */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {!isSelf && currentUser && (
                      <button
                        id={`post-follow-btn-${post.username}`}
                        disabled={followLoading[post.username]}
                        onClick={() => handleToggleFollow(post.username, Boolean(currentUser.followingCount))}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 text-slate-300 border border-slate-700/80 transition-all"
                      >
                        {followLoading[post.username] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    )}

                    {!isSelf && onStartChat && (
                      <button
                        title="Direct Message"
                        onClick={() => onStartChat(post.username)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 rounded-lg transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}

                    {canDelete && (
                      <button
                        id={`delete-post-${post.id}`}
                        title="Delete Post"
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Post Content */}
                <div className="p-4 space-y-3">
                  {post.content && (
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line break-words">
                      {post.content}
                    </p>
                  )}

                  {/* Post Media Attachment */}
                  {post.mediaUrl && (
                    <div
                      className="rounded-xl overflow-hidden border border-slate-800 max-h-96 bg-black/50 cursor-pointer group"
                      onClick={() => setLightboxUrl(post.mediaUrl || null)}
                    >
                      {post.mediaType === 'video' ? (
                        <video src={post.mediaUrl} controls className="w-full max-h-96 object-contain" />
                      ) : (
                        <img
                          src={post.mediaUrl}
                          alt="Post attachment"
                          className="w-full max-h-96 object-cover group-hover:scale-[1.01] transition-transform duration-200"
                        />
                      )}
                    </div>
                  )}

                  {/* Hashtags list */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {post.tags.map((t) => (
                        <button
                          key={t}
                          onClick={() => setSelectedTag(t)}
                          className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline font-medium"
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Post Footer / Engagement Bar */}
                <div className="px-4 py-2.5 bg-slate-950/40 border-t border-slate-800/70 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center space-x-4">
                    {/* Like Action */}
                    <button
                      id={`like-post-${post.id}`}
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center space-x-1.5 py-1 px-2 rounded-lg transition-all ${
                        isLiked
                          ? 'text-rose-400 bg-rose-500/10 font-medium'
                          : 'hover:text-rose-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 transition-transform active:scale-125 ${
                          isLiked ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                      <span>{post.likes.length}</span>
                    </button>

                    {/* Comments Toggle Action */}
                    <button
                      id={`comments-toggle-${post.id}`}
                      onClick={() => toggleComments(post.id)}
                      className={`flex items-center space-x-1.5 py-1 px-2 rounded-lg transition-all ${
                        isCommentsOpen
                          ? 'text-emerald-400 bg-emerald-500/10 font-medium'
                          : 'hover:text-emerald-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments?.length || 0}</span>
                    </button>
                  </div>

                  {/* Share Action */}
                  <button
                    id={`share-post-${post.id}`}
                    onClick={() => handleCopyPost(post)}
                    className="flex items-center space-x-1 py-1 px-2 rounded-lg hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
                  >
                    {copiedId === post.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Collapsible Comments Section */}
                {isCommentsOpen && (
                  <div className="p-4 bg-slate-950/70 border-t border-slate-800/80 space-y-3 animate-fade-in">
                    {/* Add Comment Input */}
                    {currentUser && (
                      <div className="flex items-center space-x-2">
                        <img
                          src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`}
                          alt={currentUser.username}
                          className="w-7 h-7 rounded-full border border-slate-700 object-cover flex-shrink-0"
                        />
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={commentDrafts[post.id] || ''}
                            onChange={(e) =>
                              setCommentDrafts({ ...commentDrafts, [post.id]: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddComment(post.id);
                              }
                            }}
                            placeholder="Write a comment..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3 pr-9 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                          />
                          <button
                            type="button"
                            disabled={commentSubmitting[post.id] || !(commentDrafts[post.id] || '').trim()}
                            onClick={() => handleAddComment(post.id)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {commentSubmitting[post.id] ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Comments List */}
                    {post.comments && post.comments.length > 0 ? (
                      <div className="space-y-2.5 pt-2 divide-y divide-slate-800/40">
                        {post.comments.map((c) => {
                          const canDeleteComment =
                            c.username.toLowerCase() === currentUser?.username.toLowerCase() ||
                            post.username.toLowerCase() === currentUser?.username.toLowerCase() ||
                            currentUser?.username.toLowerCase() === 'batchit';

                          return (
                            <div key={c.id} className="pt-2 flex items-start justify-between space-x-2 group">
                              <div className="flex items-start space-x-2 min-w-0">
                                <button
                                  onClick={() => onOpenProfile?.(c.username)}
                                  className="flex-shrink-0"
                                >
                                  <img
                                    src={c.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${c.username}`}
                                    alt={c.username}
                                    className="w-6 h-6 rounded-full border border-slate-800 object-cover mt-0.5"
                                  />
                                </button>
                                <div className="min-w-0">
                                  <div className="flex items-center space-x-1.5">
                                    <button
                                      onClick={() => onOpenProfile?.(c.username)}
                                      className="text-xs font-semibold text-slate-300 hover:text-emerald-400"
                                    >
                                      @{c.username}
                                    </button>
                                    <span className="text-[10px] text-slate-500">
                                      {formatTime(c.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-300 break-words">{c.text}</p>
                                </div>
                              </div>

                              {canDeleteComment && (
                                <button
                                  title="Delete Comment"
                                  onClick={() => handleDeleteComment(post.id, c.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 text-center py-2">
                        No comments yet. Be the first to share your thoughts!
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={lightboxUrl}
              alt="Enlarged view"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-10 right-0 p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
