import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, limit, runTransaction } from 'firebase/firestore';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  signInWithFacebook,
  signInWithApple,
  signInWithDiscord,
  logout, 
  OperationType, 
  handleFirestoreError 
} from './firebase';
import { UserProfile, Character, ChatSession, Message, Story } from './types';
import { getChatResponse, generateCharacterAvatar, generateStory } from './gemini';
import { 
  MessageSquare, 
  Plus, 
  User as UserIcon, 
  LogOut, 
  Search, 
  Send, 
  ArrowLeft, 
  Ghost, 
  Sparkles, 
  Trash2,
  MoreVertical,
  Settings,
  Image as ImageIcon,
  Share2,
  Copy,
  Check,
  CheckCheck,
  Globe,
  Lock,
  Star,
  Zap,
  Info,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  Heart,
  ThumbsUp,
  UserPlus,
  UserMinus,
  Facebook,
  Apple,
  Mail,
  Phone,
  Chrome,
  BookOpen,
  Wand2,
  History as HistoryIcon,
  Calendar,
  Eye
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow, format } from 'date-fns';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Context ---
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

interface SearchContextType {
  search: string;
  setSearch: (s: string) => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });
const SearchContext = createContext<SearchContextType>({ search: "", setSearch: () => {} });

const useAuth = () => useContext(AuthContext);
const useSearch = () => useContext(SearchContext);

// --- Components ---

const StarRating = ({ rating, count, size = "sm" }: { rating?: number, count?: number, size?: "sm" | "md" }) => {
  const stars = Math.round(rating || 0);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star 
            key={s} 
            className={cn(
              size === "sm" ? "w-3 h-3" : "w-4 h-4",
              s <= stars ? "text-orange-500 fill-orange-500" : "text-zinc-700"
            )} 
          />
        ))}
      </div>
      {count !== undefined && count > 0 && (
        <span className={cn("text-zinc-500 font-bold", size === "sm" ? "text-[10px]" : "text-xs")}>
          {rating?.toFixed(1)} <span className="opacity-50 font-medium">({count})</span>
        </span>
      )}
    </div>
  );
};

const RatingInput = ({ currentRating, onRate }: { currentRating?: number, onRate: (rating: number) => void }) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-3 rounded-2xl shadow-2xl">
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] pl-1">Rate this bot</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onRate(s)}
            className="transition-all hover:scale-125 active:scale-95"
          >
            <Star 
              className={cn(
                "w-5 h-5 transition-colors",
                s <= (hover || currentRating || 0) ? "text-orange-500 fill-orange-500" : "text-zinc-800"
              )} 
            />
          </button>
        ))}
      </div>
    </div>
  );
};

const LoginModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  const providers = [
    { name: 'Google', icon: <Chrome className="w-5 h-5" />, action: signInWithGoogle, color: 'bg-white text-black hover:bg-zinc-200' },
    { name: 'Facebook', icon: <Facebook className="w-5 h-5" />, action: signInWithFacebook, color: 'bg-[#1877F2] text-white hover:bg-[#166fe5]' },
    { name: 'Apple', icon: <Apple className="w-5 h-5" />, action: signInWithApple, color: 'bg-white text-black hover:bg-zinc-200' },
    { name: 'Discord', icon: <MessageSquare className="w-5 h-5" />, action: signInWithDiscord, color: 'bg-[#5865F2] text-white hover:bg-[#4752c4]' },
    { name: 'Email', icon: <Mail className="w-5 h-5" />, action: () => alert("Email signup is coming soon! Please use a social provider for now."), color: 'bg-zinc-800 text-white hover:bg-zinc-700' },
    { name: 'Phone', icon: <Phone className="w-5 h-5" />, action: () => alert("Phone signup is coming soon! Please use a social provider for now."), color: 'bg-zinc-800 text-white hover:bg-zinc-700' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-950 border border-zinc-800 p-8 rounded-[2.5rem] max-w-sm w-full space-y-8 text-center shadow-3xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500" />
        
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-zinc-900 rounded-full text-zinc-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2">
          <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-2xl font-black uppercase italic tracking-tighter">Join Lumina</h3>
          <p className="text-zinc-500 text-sm font-medium">Choose your preferred way to forge your legend.</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {providers.map((p) => (
            <button
              key={p.name}
              onClick={async () => {
                try {
                  await p.action();
                  onClose();
                } catch (err) {
                  console.error(err);
                }
              }}
              className={cn(
                "flex items-center justify-center gap-3 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all hover:scale-[1.02] active:scale-95 shadow-xl",
                p.color
              )}
            >
              {p.icon}
              Continue with {p.name}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-zinc-600 font-medium px-4">
          By continuing, you agree to our <span className="text-zinc-400 underline cursor-pointer">Terms of Service</span> and <span className="text-zinc-400 underline cursor-pointer">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
};

const Navbar = () => {
  const { user, profile } = useAuth();
  const { search, setSearch } = useSearch();
  const [showNSFW, setShowNSFW] = useState(false);
  const [showAgePrompt, setShowAgePrompt] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [ageInput, setAgeInput] = useState("");

  useEffect(() => {
    const handleNSFWToggle = (e: any) => setShowNSFW(e.detail);
    window.addEventListener('nsfwToggle', handleNSFWToggle);
    return () => window.removeEventListener('nsfwToggle', handleNSFWToggle);
  }, []);

  const toggleNSFW = async () => {
    if (!showNSFW) {
      // Check age
      if (!profile?.age) {
        setShowAgePrompt(true);
        return;
      }
      if (profile.age < 18) {
        alert("You must be 18+ to view NSFW content.");
        return;
      }
    }
    const newState = !showNSFW;
    setShowNSFW(newState);
    window.dispatchEvent(new CustomEvent('nsfwToggle', { detail: newState }));
  };

  const handleAgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const age = parseInt(ageInput);
    if (isNaN(age) || age < 1) {
      alert("Please enter a valid age.");
      return;
    }

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { age });
        setShowAgePrompt(false);
        if (age >= 18) {
          toggleNSFW();
        } else {
          alert("You must be 18+ to view NSFW content.");
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 z-50 px-4 sm:px-8 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 group shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-all shadow-lg shadow-orange-500/20">
            <Sparkles className="text-white w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-lg sm:text-2xl font-black bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent hidden md:block tracking-tighter uppercase italic">
            Lumina
          </span>
        </Link>

        <div className="flex-1 max-w-md relative group hidden sm:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4 group-focus-within:text-orange-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search characters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:border-orange-500 transition-all text-sm"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <button 
            onClick={toggleNSFW}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
              showNSFW 
                ? "bg-red-500/10 border-red-500/20 text-red-500" 
                : "bg-zinc-900 border-zinc-800 text-zinc-500"
            )}
          >
            <Zap className={cn("w-3 h-3", showNSFW ? "fill-red-500" : "")} />
            <span className="hidden xs:inline">NSFW: {showNSFW ? "ON" : "OFF"}</span>
          </button>

          <Link to="/create" className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-2 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95">
            <Plus className="w-4 h-4 text-orange-500" />
            <span className="hidden sm:inline">Create</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/history" className="p-2.5 hover:bg-zinc-900 rounded-2xl text-zinc-500 hover:text-white transition-all relative group">
                <MessageSquare className="w-5 h-5" />
              </Link>
              <Link to="/stories" className="p-2.5 hover:bg-zinc-900 rounded-2xl text-zinc-500 hover:text-white transition-all relative group">
                <BookOpen className="w-5 h-5" />
              </Link>
              <div className="w-px h-6 bg-zinc-800 mx-1 sm:mx-2" />
              <div className="flex items-center gap-3">
                <Link to="/profile" className="relative group cursor-pointer">
                  <img src={profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="" className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl border-2 border-zinc-800 group-hover:border-orange-500 transition-all object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-zinc-950 rounded-full" />
                </Link>
                <Link to="/settings" className="p-2.5 hover:bg-zinc-900 rounded-2xl text-zinc-500 hover:text-white transition-all">
                  <Settings className="w-5 h-5" />
                </Link>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-black uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 shadow-xl shadow-orange-500/20"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      {showAgePrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] max-w-sm w-full space-y-6 text-center shadow-3xl"
          >
            <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <Zap className="w-8 h-8 text-orange-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase italic tracking-tighter">Age Verification</h3>
              <p className="text-zinc-400 text-sm">Please enter your age to access NSFW content. You must be 18 or older.</p>
            </div>
            <form onSubmit={handleAgeSubmit} className="space-y-4">
              <input 
                type="number" 
                placeholder="Your age"
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:border-orange-500 transition-all text-center text-xl font-black"
              />
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAgePrompt(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-orange-500/20"
                >
                  Confirm
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </>
  );
};

const CharacterCard = ({ character, onTogglePublic, onDelete }: { character: Character, onTogglePublic?: (id: string, isPublic: boolean) => void, onDelete?: () => void }) => {
  const [copied, setCopied] = useState(false);
  const { user, profile } = useAuth();
  const isFavorite = profile?.favorites?.includes(character.id);
  const isLiked = profile?.likedCharacters?.includes(character.id);

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = `${window.location.origin}/chat/${character.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const newFavorites = isFavorite 
      ? profile.favorites.filter(id => id !== character.id)
      : [...(profile.favorites || []), character.id];

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        favorites: newFavorites
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const toggleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const characterRef = doc(db, 'characters', character.id);
    const userRef = doc(db, 'users', user.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const charDoc = await transaction.get(characterRef);
        if (!charDoc.exists()) return;

        const currentLikes = charDoc.data().likesCount || 0;
        const newLikedCharacters = isLiked
          ? (profile.likedCharacters || []).filter(id => id !== character.id)
          : [...(profile.likedCharacters || []), character.id];

        transaction.update(userRef, { likedCharacters: newLikedCharacters });
        transaction.update(characterRef, { 
          likesCount: isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1 
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `characters/${character.id}`);
    }
  };

  return (
    <div className="group relative">
      <Link 
        to={`/chat/${character.id}`} 
        className="block relative bg-zinc-900 border border-zinc-800/50 rounded-[2.5rem] overflow-hidden hover:border-orange-500/40 transition-all hover:-translate-y-2 shadow-2xl flex flex-col aspect-[3/4.5] isolate"
      >
        <div className="absolute inset-0 z-0">
          <img 
            src={character.avatarUrl || `https://picsum.photos/seed/${character.id}/400/600`} 
            alt={character.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out opacity-80 group-hover:opacity-100"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
        </div>
        
        <div className="relative z-10 flex flex-col h-full p-6">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-2xl border border-white/5">
                <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                <span className="text-[10px] font-black text-white">{character.averageRating?.toFixed(1) || "5.0"}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-2xl border border-white/5">
                <ThumbsUp className={cn("w-3 h-3", isLiked ? "text-orange-500 fill-orange-500" : "text-zinc-400")} />
                <span className="text-[10px] font-black text-white">{character.likesCount || 0}</span>
              </div>
            </div>
            
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button 
                onClick={toggleLike}
                className={cn(
                  "p-2.5 backdrop-blur-xl rounded-2xl transition-all shadow-xl border border-white/5",
                  isLiked ? "bg-orange-500 text-white" : "bg-black/60 text-white hover:bg-zinc-800"
                )}
              >
                <ThumbsUp className={cn("w-4 h-4", isLiked ? "fill-white" : "")} />
              </button>
              <button 
                onClick={toggleFavorite}
                className={cn(
                  "p-2.5 backdrop-blur-xl rounded-2xl transition-all shadow-xl border border-white/5",
                  isFavorite ? "bg-orange-500 text-white" : "bg-black/60 text-white hover:bg-zinc-800"
                )}
              >
                <Heart className={cn("w-4 h-4", isFavorite ? "fill-white" : "")} />
              </button>
              {onTogglePublic && (
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    onTogglePublic(character.id, !character.isPublic);
                  }}
                  className="p-2.5 bg-black/60 backdrop-blur-xl rounded-2xl text-white hover:bg-orange-500 transition-colors shadow-xl border border-white/5"
                >
                  {character.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
              )}
              {onDelete && (
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                  className="p-2.5 bg-black/60 backdrop-blur-xl rounded-2xl text-white hover:bg-red-500 transition-colors shadow-xl border border-white/5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={handleShare}
                className="p-2.5 bg-black/60 backdrop-blur-xl rounded-2xl text-white hover:bg-orange-500 transition-colors shadow-xl border border-white/5"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="mt-auto space-y-3">
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white tracking-tight leading-none group-hover:text-orange-400 transition-colors">{character.name}</h3>
              <Link 
                to={`/user/${character.creatorId}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-orange-500 transition-all"
              >
                <UserIcon className="w-3 h-3" />
                {character.creatorName || "Lumina Creator"}
              </Link>
            </div>
            
            <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed font-medium opacity-80 group-hover:opacity-100 transition-opacity">
              {character.personality}
            </p>

            {character.tags && character.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {character.isNSFW && (
                  <span className="text-[8px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                    NSFW
                  </span>
                )}
                {character.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[8px] font-black uppercase tracking-widest text-orange-500/60 bg-orange-500/5 px-2 py-0.5 rounded-full border border-orange-500/10">
                    {tag}
                  </span>
                ))}
                {character.tags.length > 3 && (
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
                    +{character.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-black uppercase tracking-widest">
                <MessageSquare className="w-3.5 h-3.5 text-orange-500" />
                {character.ratingCount || 0} Chats
              </div>
              {character.isPublic ? (
                <div className="flex items-center gap-1.5 text-[10px] text-green-500 font-black uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                  <Lock className="w-3 h-3" />
                  Private
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
      {isFavorite && (
        <div className="absolute top-4 left-4 z-20 p-2 bg-orange-500 rounded-full text-white shadow-lg shadow-orange-500/20">
          <Star className="w-3 h-3 fill-white" />
        </div>
      )}
    </div>
  );
};

const RecentChats = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatSession[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'chats'));

    return () => unsubscribe();
  }, [user]);

  if (!user || chats.length === 0) return null;

  return (
    <div className="mb-20">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter">Continue Chatting</h2>
        <div className="h-[1px] flex-1 bg-zinc-800 mx-6 opacity-50" />
      </div>
      
      <div className="flex gap-6 overflow-x-auto pb-8 no-scrollbar -mx-4 px-4">
        {chats.map(chat => (
          <Link 
            key={chat.id} 
            to={`/chat/${chat.characterId}`}
            className="flex-shrink-0 group relative w-44 sm:w-56 aspect-[3/4] bg-zinc-900 border border-zinc-800/50 rounded-[2.5rem] overflow-hidden hover:border-orange-500/40 transition-all hover:-translate-y-2 shadow-2xl isolate"
          >
            <div className="absolute inset-0 z-0">
              <img 
                src={chat.characterAvatarUrl || `https://picsum.photos/seed/${chat.characterId}/400/600`} 
                alt={chat.characterName}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out opacity-60 group-hover:opacity-100"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
              <h3 className="text-lg font-black text-white leading-tight group-hover:text-orange-400 transition-colors truncate">{chat.characterName}</h3>
              <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1 opacity-80">
                {chat.updatedAt ? formatDistanceToNow(chat.updatedAt.toDate(), { addSuffix: true }) : "Recent"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

const Home = () => {
  const { profile } = useAuth();
  const { search } = useSearch();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [category, setCategory] = useState("All");
  const [showNSFW, setShowNSFW] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState({
    creativity: 'All',
    responseLength: 'All',
    strictness: 'All',
    isPublic: 'All',
    tags: [] as string[]
  });

  useEffect(() => {
    const handleNSFWToggle = (e: any) => setShowNSFW(e.detail);
    window.addEventListener('nsfwToggle', handleNSFWToggle);
    return () => window.removeEventListener('nsfwToggle', handleNSFWToggle);
  }, []);

  const categories = ["All", "Featured", "Roleplay", "Anime", "Helpers", "Game Characters", "Historical", "Horror", "Romance", "Comedy", "Action"];

  useEffect(() => {
    const q = query(
      collection(db, 'characters'),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character));
      setCharacters(chars);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'characters'));

    return () => unsubscribe();
  }, []);

  const filtered = characters.filter(c => {
    const matchesSearch = (c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.personality.toLowerCase().includes(search.toLowerCase()) ||
      (c.tags && c.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))));
    
    const matchesCategory = (category === "All" || (category === "Featured" && (c.ratingCount || 0) > 0) || (c.tags && c.tags.includes(category)));
    const matchesNSFW = (showNSFW ? true : !c.isNSFW);
    
    const matchesCreativity = filters.creativity === 'All' || c.creativity === filters.creativity.toLowerCase();
    const matchesResponseLength = filters.responseLength === 'All' || c.responseLength === filters.responseLength.toLowerCase();
    const matchesStrictness = filters.strictness === 'All' || c.strictness === filters.strictness.toLowerCase();
    const matchesPublic = filters.isPublic === 'All' || (filters.isPublic === 'Public' ? c.isPublic : !c.isPublic);
    const matchesTags = filters.tags.length === 0 || (c.tags && filters.tags.every(tag => c.tags?.includes(tag)));

    return matchesSearch && matchesCategory && matchesNSFW && 
           matchesCreativity && matchesResponseLength && matchesStrictness && 
           matchesPublic && matchesTags;
  });

  const favorites = characters.filter(c => profile?.favorites?.includes(c.id));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20 pt-20">
      <div className="px-4 max-w-7xl mx-auto space-y-12">
        
        <RecentChats />

        {favorites.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                <Star className="w-8 h-8 text-orange-500 fill-orange-500" />
                Favorites
              </h2>
              <div className="h-[1px] flex-1 bg-zinc-800 mx-6 opacity-50" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {favorites.map(char => (
                <CharacterCard key={char.id} character={char} />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">Discover</h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Find your next favorite personality</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  "px-6 py-3 rounded-full font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all border relative",
                  showAdvanced 
                    ? "bg-zinc-800 border-orange-500 text-orange-500" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                )}
              >
                <Filter className="w-4 h-4" />
                Advanced Filters
                {(filters.creativity !== 'All' || filters.responseLength !== 'All' || filters.strictness !== 'All' || filters.isPublic !== 'All' || filters.tags.length > 0) && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[8px] flex items-center justify-center rounded-full border-2 border-zinc-900">
                    { (filters.creativity !== 'All' ? 1 : 0) + 
                      (filters.responseLength !== 'All' ? 1 : 0) + 
                      (filters.strictness !== 'All' ? 1 : 0) + 
                      (filters.isPublic !== 'All' ? 1 : 0) + 
                      (filters.tags.length > 0 ? 1 : 0) }
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-full px-4 py-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{filtered.length} Bots</span>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800 rounded-[2.5rem] p-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-left shadow-3xl mb-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Zap className="w-3 h-3 text-orange-500" />
                      AI Behavior
                    </h4>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Creativity</label>
                        <div className="flex flex-wrap gap-2">
                          {['All', 'Low', 'Medium', 'High'].map(opt => (
                            <button 
                              key={opt}
                              onClick={() => setFilters(f => ({ ...f, creativity: opt }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                                filters.creativity === opt 
                                  ? "bg-orange-500/10 border-orange-500/50 text-orange-500" 
                                  : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Response Length</label>
                        <div className="flex flex-wrap gap-2">
                          {['All', 'Short', 'Medium', 'Long'].map(opt => (
                            <button 
                              key={opt}
                              onClick={() => setFilters(f => ({ ...f, responseLength: opt }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                                filters.responseLength === opt 
                                  ? "bg-orange-500/10 border-orange-500/50 text-orange-500" 
                                  : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Globe className="w-3 h-3 text-orange-500" />
                      Visibility & Tags
                    </h4>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Access</label>
                        <div className="flex flex-wrap gap-2">
                          {['All', 'Public', 'Private'].map(opt => (
                            <button 
                              key={opt}
                              onClick={() => setFilters(f => ({ ...f, isPublic: opt }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                                filters.isPublic === opt 
                                  ? "bg-orange-500/10 border-orange-500/50 text-orange-500" 
                                  : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Popular Tags</label>
                        <div className="flex flex-wrap gap-2">
                          {['Fantasy', 'Sci-Fi', 'Anime', 'Friendly', 'Villain', 'Horror', 'Romance', 'Comedy', 'Action', 'Historical'].map(tag => (
                            <button 
                              key={tag}
                              onClick={() => {
                                setFilters(f => ({
                                  ...f,
                                  tags: f.tags.includes(tag) 
                                    ? f.tags.filter(t => t !== tag) 
                                    : [...f.tags, tag]
                                }))
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                                filters.tags.includes(tag) 
                                  ? "bg-orange-500/10 border-orange-500/50 text-orange-500" 
                                  : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                              )}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Info className="w-3 h-3 text-orange-500" />
                      Other
                    </h4>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Strictness</label>
                        <div className="flex flex-wrap gap-2">
                          {['All', 'Flexible', 'Balanced', 'Strict'].map(opt => (
                            <button 
                              key={opt}
                              onClick={() => setFilters(f => ({ ...f, strictness: opt }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                                filters.strictness === opt 
                                  ? "bg-orange-500/10 border-orange-500/50 text-orange-500" 
                                  : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setFilters({
                            creativity: 'All',
                            responseLength: 'All',
                            strictness: 'All',
                            isPublic: 'All',
                            tags: []
                          });
                        }}
                        className="w-full mt-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-orange-500 transition-colors border border-zinc-800 hover:border-orange-500/30"
                      >
                        Reset Filters
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sticky top-16 bg-zinc-950/80 backdrop-blur-md z-30 py-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap",
                  category === cat 
                    ? "bg-orange-500 border-orange-500 text-white shadow-xl shadow-orange-500/20 scale-105" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filtered.map(char => (
              <CharacterCard key={char.id} character={char} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pt-24 pb-12 px-4 max-w-4xl mx-auto">
      <div className="mb-12 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">Settings</h1>
      </div>

      <div className="space-y-8">
        <section className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-orange-500">
              <UserIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight">Account Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Display Name</p>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 text-zinc-300 font-bold">
                {user.displayName || "Not set"}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Email Address</p>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 text-zinc-300 font-bold">
                {user.email}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-orange-500">
              <Settings className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight">Preferences</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
              <div>
                <p className="font-bold text-white">Dark Mode</p>
                <p className="text-xs text-zinc-500">Always on for Lumina.AI</p>
              </div>
              <div className="w-12 h-6 bg-orange-500 rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
          </div>
        </section>

        <button 
          onClick={logout}
          className="w-full bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/20 text-zinc-500 hover:text-red-500 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

const PublicProfile = () => {
  const { userId } = useParams();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    
    const fetchProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', userId));
        if (docSnap.exists()) {
          setTargetProfile(docSnap.data() as UserProfile);
        }
      } catch (err) {
        console.error(err);
      }
    };

    const fetchCharacters = async () => {
      const q = query(
        collection(db, 'characters'),
        where('creatorId', '==', userId),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setCharacters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character)));
      });
      return unsubscribe;
    };

    fetchProfile();
    const unsubChars = fetchCharacters();
    setLoading(false);

    return () => {
      unsubChars.then(unsub => unsub());
    };
  }, [userId]);

  useEffect(() => {
    if (currentProfile && userId) {
      setIsFollowing(currentProfile.following?.includes(userId) || false);
    }
  }, [currentProfile, userId]);

  const toggleFollow = async () => {
    if (!currentUser || !currentProfile || !userId || userId === currentUser.uid) return;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', currentUser.uid);
        const creatorRef = doc(db, 'users', userId);

        const userSnap = await transaction.get(userRef);
        const creatorSnap = await transaction.get(creatorRef);

        if (!userSnap.exists() || !creatorSnap.exists()) return;

        const userData = userSnap.data() as UserProfile;
        const creatorData = creatorSnap.data() as UserProfile;

        const following = userData.following || [];
        const isFollowingNow = following.includes(userId);

        if (isFollowingNow) {
          transaction.update(userRef, {
            following: following.filter(id => id !== userId)
          });
          transaction.update(creatorRef, {
            followersCount: Math.max(0, (creatorData.followersCount || 0) - 1)
          });
        } else {
          transaction.update(userRef, {
            following: [...following, userId]
          });
          transaction.update(creatorRef, {
            followersCount: (creatorData.followersCount || 0) + 1
          });
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (!targetProfile) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 space-y-4">
      <Ghost className="w-16 h-16 opacity-20" />
      <p className="font-black uppercase tracking-widest text-xs">Creator not found</p>
      <Link to="/" className="text-orange-500 font-bold hover:underline">Return Home</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pt-24 pb-12 px-4 max-w-7xl mx-auto">
      <div className="mb-12 flex flex-col items-center text-center space-y-6">
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-zinc-900 border-4 border-zinc-800 overflow-hidden shadow-2xl">
            <img src={targetProfile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetProfile.uid}`} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/20 border-4 border-zinc-950">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-black uppercase italic tracking-tighter">{targetProfile.displayName || "Anonymous Creator"}</h1>
            <div className="flex items-center justify-center gap-3">
              <p className="text-zinc-500 font-medium">Joined {formatDistanceToNow(targetProfile.createdAt.toDate())} ago</p>
              <div className="w-1 h-1 bg-zinc-800 rounded-full" />
              <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full border border-orange-500/20">
                <UserPlus className="w-3 h-3" />
                <span className="text-[10px] font-black uppercase tracking-widest">{targetProfile.followersCount || 0} Followers</span>
              </div>
            </div>
          </div>
          
          {currentUser && userId !== currentUser.uid && (
            <button 
              onClick={toggleFollow}
              className={cn(
                "px-8 py-3 rounded-full font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2 mx-auto",
                isFollowing 
                  ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" 
                  : "bg-orange-500 text-white hover:bg-orange-600 shadow-xl shadow-orange-500/20"
              )}
            >
              {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {isFollowing ? "Unfollow" : "Follow"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-8 pt-4">
          <div className="text-center group cursor-default">
            <p className="text-4xl font-black text-white group-hover:text-orange-500 transition-colors">{targetProfile.followersCount || 0}</p>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Followers</p>
          </div>
          <div className="w-[1px] h-12 bg-zinc-800" />
          <div className="text-center">
            <p className="text-4xl font-black text-white">{targetProfile.following?.length || 0}</p>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Following</p>
          </div>
          <div className="w-[1px] h-12 bg-zinc-800" />
          <div className="text-center">
            <p className="text-4xl font-black text-white">{characters.length}</p>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Creations</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Creations</h2>
        {characters.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-8">
            {characters.map(char => (
              <CharacterCard key={char.id} character={char} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-zinc-900/50 rounded-[3rem] border border-zinc-800 border-dashed">
            <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">No public creations yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Profile = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || "");
  const [newAge, setNewAge] = useState(profile?.age?.toString() || "");
  const [newPhotoURL, setNewPhotoURL] = useState(user?.photoURL || "");
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'characters'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMyCharacters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character)));
    });
    return () => unsubscribe();
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      await updateProfile(user, {
        displayName: newName,
        photoURL: newPhotoURL
      });
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: newName,
        photoURL: newPhotoURL,
        age: parseInt(newAge) || 0
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this character? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'characters', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `characters/${id}`);
    }
  };

  if (!user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pt-24 pb-12 px-4 max-w-7xl mx-auto">
      <div className="mb-12 flex flex-col items-center text-center space-y-6">
        <div className="relative group">
          <div className="w-32 h-32 rounded-full bg-zinc-900 border-4 border-zinc-800 overflow-hidden shadow-2xl group-hover:border-orange-500 transition-all duration-500">
            <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/20 border-4 border-zinc-950">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        </div>
        
        {isEditing ? (
          <div className="w-full max-w-md space-y-4 bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Display Name</label>
              <input 
                type="text" 
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-orange-500 transition-all font-bold"
              />
            </div>
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Age</label>
              <input 
                type="number" 
                value={newAge}
                onChange={e => setNewAge(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-orange-500 transition-all font-bold"
              />
            </div>
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Photo URL</label>
              <input 
                type="url" 
                value={newPhotoURL}
                onChange={e => setNewPhotoURL(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-orange-500 transition-all font-mono text-xs"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={handleUpdateProfile}
                disabled={updating}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-orange-600 transition-all disabled:opacity-50"
              >
                {updating ? "Saving..." : "Save Changes"}
              </button>
              <button 
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-zinc-800 text-zinc-400 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-700 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-black uppercase italic tracking-tighter">{user.displayName || "Anonymous Creator"}</h1>
              <div className="flex items-center justify-center gap-3">
                <p className="text-zinc-500 font-medium">{user.email}</p>
                <div className="w-1 h-1 bg-zinc-800 rounded-full" />
                <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full border border-orange-500/20">
                  <UserPlus className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{profile?.followersCount || 0} Followers</span>
                </div>
              </div>
              {profile?.age && <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">Age: {profile.age}</p>}
            </div>
            <button 
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:border-orange-500 hover:text-orange-500 transition-all"
            >
              Edit Profile
            </button>
          </div>
        )}

        <div className="flex items-center gap-8 pt-4">
          <div className="text-center">
            <p className="text-2xl font-black text-white">{profile?.followersCount || 0}</p>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Followers</p>
          </div>
          <div className="w-[1px] h-8 bg-zinc-800" />
          <div className="text-center">
            <p className="text-2xl font-black text-white">{profile?.following?.length || 0}</p>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Following</p>
          </div>
          <div className="w-[1px] h-8 bg-zinc-800" />
          <div className="text-center">
            <p className="text-2xl font-black text-white">{myCharacters.length}</p>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Creations</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black uppercase italic tracking-tighter">My Creations</h2>
          <Link to="/create" className="text-xs font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Character
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-8">
          {myCharacters.map(char => (
            <CharacterCard 
              key={char.id} 
              character={char} 
              onDelete={() => handleDeleteCharacter(char.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const StoryGeneratorModal = ({ isOpen, onClose, character }: { isOpen: boolean, onClose: () => void, character: Character }) => {
  const { user } = useAuth();
  const [scenario, setScenario] = useState(character.scenario || "");
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const storyData = await generateStory(character, scenario);
      const storyRef = await addDoc(collection(db, 'stories'), {
        characterId: character.id,
        characterName: character.name,
        userId: user.uid,
        title: storyData.title,
        content: storyData.content,
        scenario: scenario,
        createdAt: serverTimestamp()
      });
      onClose();
      navigate(`/story/${storyRef.id}`);
    } catch (err) {
      console.error("Error generating story:", err);
      alert("Failed to generate story. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-950 border border-zinc-800 p-8 rounded-[2.5rem] max-w-lg w-full space-y-6 shadow-3xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500" />
        
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-zinc-900 rounded-full text-zinc-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2">
          <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-2xl font-black uppercase italic tracking-tighter text-center">Generate a Story</h3>
          <p className="text-zinc-500 text-sm font-medium text-center">Forge a new legend for {character.name}.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] pl-1">Scenario (Optional)</label>
            <textarea 
              placeholder="What happens in this story? (e.g., 'A mysterious traveler arrives at the tavern...')"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:border-orange-500 transition-all text-sm min-h-[120px] resize-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-orange-500/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Forging Legend...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Story
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const StoryCard = ({ story }: { story: Story }) => {
  return (
    <Link 
      to={`/story/${story.id}`}
      className="group relative bg-zinc-900 border border-zinc-800/50 rounded-[2.5rem] p-6 hover:border-orange-500/40 transition-all hover:-translate-y-1 shadow-2xl flex flex-col gap-4"
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-white tracking-tight group-hover:text-orange-400 transition-colors line-clamp-1">{story.title}</h3>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-black uppercase tracking-widest">
            <UserIcon className="w-3 h-3" />
            {story.characterName}
          </div>
        </div>
        <div className="p-2 bg-zinc-950 rounded-xl border border-zinc-800">
          <BookOpen className="w-4 h-4 text-orange-500" />
        </div>
      </div>
      
      <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed font-medium">
        {story.content.replace(/[#*`]/g, '').slice(0, 200)}...
      </p>

      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
        <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-black uppercase tracking-widest">
          <Calendar className="w-3 h-3" />
          {story.createdAt ? formatDistanceToNow(story.createdAt.toDate(), { addSuffix: true }) : "Recent"}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-orange-500 font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform">
          Read More
          <ArrowLeft className="w-3 h-3 rotate-180" />
        </div>
      </div>
    </Link>
  );
};

const Stories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'stories'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'stories'));

    return () => unsubscribe();
  }, [user]);

  if (!user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20 pt-28">
      <div className="px-4 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">My Stories</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Legends forged by Lumina AI</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-full px-4 py-2">
              <BookOpen className="w-4 h-4 text-orange-500" />
              <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{stories.length} Stories</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center py-32 space-y-6 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-[3rem]">
            <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto">
              <Ghost className="w-10 h-10 text-zinc-700" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase italic tracking-tighter">No stories yet</h3>
              <p className="text-zinc-500 text-sm max-w-xs mx-auto">Generate stories with your favorite characters to see them here.</p>
            </div>
            <Link to="/" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-orange-500/20">
              Discover Characters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {stories.map(story => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StoryDetail = () => {
  const { storyId } = useParams();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!storyId) return;
    const unsubscribe = onSnapshot(doc(db, 'stories', storyId), (snap) => {
      if (snap.exists()) {
        setStory({ id: snap.id, ...snap.data() } as Story);
      } else {
        navigate('/stories');
      }
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, `stories/${storyId}`));

    return () => unsubscribe();
  }, [storyId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!story) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20 pt-28">
      <div className="px-4 max-w-3xl mx-auto space-y-12">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
        </button>

        <div className="space-y-8">
          <div className="space-y-4 text-center">
            <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-orange-500" />
            </div>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">{story.title}</h1>
            <div className="flex items-center justify-center gap-4">
              <Link to={`/chat/${story.characterId}`} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-colors">
                <UserIcon className="w-4 h-4" />
                {story.characterName}
              </Link>
              <div className="w-1 h-1 bg-zinc-800 rounded-full" />
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500">
                <Calendar className="w-4 h-4" />
                {story.createdAt ? formatDistanceToNow(story.createdAt.toDate(), { addSuffix: true }) : "Recent"}
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

          {story.scenario && (
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] space-y-3">
              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Scenario</h4>
              <p className="text-sm text-zinc-400 italic leading-relaxed">"{story.scenario}"</p>
            </div>
          )}

          <div className="prose prose-invert prose-orange max-w-none">
            <div className="text-zinc-300 leading-[1.8] text-lg font-medium space-y-6">
              <ReactMarkdown>{story.content}</ReactMarkdown>
            </div>
          </div>

          <div className="pt-12 border-t border-zinc-800 flex justify-center gap-4">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert("Link copied!");
              }}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
            >
              <Share2 className="w-4 h-4" />
              Share Story
            </button>
            <Link 
              to={`/chat/${story.characterId}`}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-orange-500/20"
            >
              <MessageSquare className="w-4 h-4" />
              Chat with {story.characterName}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const History = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [activeTab, setActiveTab] = useState<'chats' | 'creations'>('chats');

  useEffect(() => {
    if (!user) return;
    
    // Fetch Chats
    const qChats = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubChats = onSnapshot(qChats, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'chats'));

    // Fetch My Creations
    const qChars = query(
      collection(db, 'characters'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubChars = onSnapshot(qChars, (snapshot) => {
      setMyCharacters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'characters'));

    return () => {
      unsubChats();
      unsubChars();
    };
  }, [user]);

  const togglePublic = async (id: string, isPublic: boolean) => {
    try {
      await updateDoc(doc(db, 'characters', id), { isPublic });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `characters/${id}`);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this character? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'characters', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `characters/${id}`);
    }
  };

  if (!user) return <Navigate to="/" />;

  return (
    <div className="pt-24 pb-12 px-4 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h1 className="text-4xl font-black tracking-tight">Your Library</h1>
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button 
            onClick={() => setActiveTab('chats')}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'chats' ? "bg-orange-500 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Chat History
          </button>
          <button 
            onClick={() => setActiveTab('creations')}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'creations' ? "bg-orange-500 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            My Creations
          </button>
        </div>
      </div>

      {activeTab === 'chats' ? (
        <div className="space-y-4">
          {chats.length === 0 ? (
            <div className="text-center py-20 bg-zinc-900 rounded-3xl border border-zinc-800">
              <Ghost className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500">No conversations yet. Start exploring!</p>
              <Link to="/" className="text-orange-500 hover:underline mt-2 inline-block">Browse Characters</Link>
            </div>
          ) : (
            chats.map(chat => (
              <Link 
                key={chat.id} 
                to={`/chat/${chat.characterId}`}
                className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl hover:border-orange-500/50 transition-all group"
              >
                <img 
                  src={`https://picsum.photos/seed/${chat.characterId}/100/100`} 
                  alt="" 
                  className="w-16 h-16 rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-bold text-white truncate">{chat.characterName}</h3>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                      {chat.updatedAt ? formatDistanceToNow(chat.updatedAt.toDate(), { addSuffix: true }) : "Recently"}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-1 italic">
                    {chat.lastMessage || "No messages yet..."}
                  </p>
                </div>
                <div className="p-2 bg-zinc-800 rounded-full group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </div>
              </Link>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {myCharacters.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-zinc-900 rounded-3xl border border-zinc-800">
              <Sparkles className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500">You haven't created any characters yet.</p>
              <Link to="/create" className="text-orange-500 hover:underline mt-2 inline-block">Create Your First Bot</Link>
            </div>
          ) : (
            myCharacters.map(char => (
              <CharacterCard 
                key={char.id} 
                character={char} 
                onTogglePublic={togglePublic} 
                onDelete={() => handleDeleteCharacter(char.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const CreateCharacter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    personality: "",
    appearance: "",
    speechStyle: "",
    firstMessage: "",
    scenario: "",
    biography: "",
    avatarUrl: "",
    isPublic: true,
    responseLength: 'medium' as 'short' | 'medium' | 'long',
    creativity: 'medium' as 'low' | 'medium' | 'high',
    strictness: 'balanced' as 'flexible' | 'balanced' | 'strict',
    tone: 'casual' as 'formal' | 'casual' | 'humorous' | 'dramatic',
    tags: [] as string[],
    isNSFW: false
  });
  const [tagInput, setTagInput] = useState("");
  const [generatingAvatar, setGeneratingAvatar] = useState(false);

  const handleGenerateAvatar = async () => {
    if (!formData.name && !formData.personality && !formData.appearance) {
      alert("Please provide at least a name, personality, or appearance to generate an avatar.");
      return;
    }
    setGeneratingAvatar(true);
    const prompt = `Name: ${formData.name}. Personality: ${formData.personality}. Appearance: ${formData.appearance}. Description: ${formData.description}`;
    const result = await generateCharacterAvatar(prompt);
    if (result) {
      setFormData({ ...formData, avatarUrl: result });
    } else {
      alert("Failed to generate avatar. Please try again.");
    }
    setGeneratingAvatar(false);
  };

  if (!user) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const charRef = collection(db, 'characters');
      const docRef = await addDoc(charRef, {
        ...formData,
        creatorId: user.uid,
        creatorName: user.displayName || "Anonymous",
        createdAt: serverTimestamp(),
        averageRating: 5.0,
        ratingCount: 0
      });
      navigate(`/chat/${docRef.id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'characters');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-24 pb-12 px-4 max-w-4xl mx-auto">
      <div className="mb-12 text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-500 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-500/20">
          <Sparkles className="w-3 h-3" />
          Creation Lab
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase italic">
          Forge a <span className="text-orange-500">Legend.</span>
        </h1>
        <p className="text-zinc-500 text-lg font-medium">Define the soul, voice, and spirit of your AI companion.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        {/* Basic Info */}
        <section className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-[2.5rem] p-6 sm:p-10 space-y-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-orange-500">
              <UserIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight">Identity</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Name</label>
              <input 
                required
                type="text" 
                placeholder="e.g. Luna the Archmage"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Avatar URL</label>
              <div className="relative">
                <input 
                  type="url" 
                  placeholder="https://..."
                  value={formData.avatarUrl}
                  onChange={e => setFormData({...formData, avatarUrl: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 transition-all font-mono text-xs pr-32"
                />
                <button 
                  type="button"
                  onClick={handleGenerateAvatar}
                  disabled={generatingAvatar}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {generatingAvatar ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ImageIcon className="w-3 h-3" />
                  )}
                  {generatingAvatar ? "Generating..." : "AI Generate"}
                </button>
              </div>
              {formData.avatarUrl && formData.avatarUrl.startsWith('data:image') && (
                <p className="text-[10px] text-green-500 font-bold ml-1 uppercase tracking-widest">AI Avatar Generated!</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Short Description</label>
            <input 
              required
              type="text" 
              placeholder="A brief tagline for your character..."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 transition-all font-medium"
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Tags / Keywords</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map(tag => (
                <span key={tag} className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-500/20 flex items-center gap-2">
                  {tag}
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, tags: formData.tags.filter(t => t !== tag)})}
                    className="hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Add tags (e.g. fantasy, hero, villain)..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (tagInput.trim() && !formData.tags.includes(tagInput.trim().toLowerCase())) {
                      setFormData({...formData, tags: [...formData.tags, tagInput.trim().toLowerCase()]});
                      setTagInput("");
                    }
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 transition-all font-medium"
              />
              <button 
                type="button"
                onClick={() => {
                  if (tagInput.trim() && !formData.tags.includes(tagInput.trim().toLowerCase())) {
                    setFormData({...formData, tags: [...formData.tags, tagInput.trim().toLowerCase()]});
                    setTagInput("");
                  }
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500 hover:text-orange-400 font-black uppercase text-[10px] tracking-widest"
              >
                Add
              </button>
            </div>
            <p className="text-[10px] text-zinc-600 font-medium ml-1 italic">Press Enter to add multiple tags.</p>
          </div>
        </section>

        {/* Personality & Bio */}
        <section className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-[2.5rem] p-6 sm:p-10 space-y-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-orange-500">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight">The Soul</h2>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Core Personality</label>
            <textarea 
              required
              rows={3}
              placeholder="Describe their traits, quirks, and mannerisms..."
              value={formData.personality}
              onChange={e => setFormData({...formData, personality: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 transition-all font-medium resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Appearance</label>
              <textarea 
                rows={3}
                placeholder="What do they look like? Clothing, features..."
                value={formData.appearance}
                onChange={e => setFormData({...formData, appearance: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 transition-all font-medium resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Speech Style</label>
              <textarea 
                rows={3}
                placeholder="How do they talk? Slang, formal, stuttering..."
                value={formData.speechStyle}
                onChange={e => setFormData({...formData, speechStyle: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 transition-all font-medium resize-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Current Scenario</label>
            <textarea 
              rows={2}
              placeholder="Where is the character right now? What's happening?"
              value={formData.scenario}
              onChange={e => setFormData({...formData, scenario: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 transition-all font-medium resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">First Message (Greeting)</label>
            <input 
              type="text" 
              placeholder="The very first thing they say to the user..."
              value={formData.firstMessage}
              onChange={e => setFormData({...formData, firstMessage: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 transition-all font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Detailed Biography</label>
            <textarea 
              rows={5}
              placeholder="Backstory, motivations, secrets..."
              value={formData.biography}
              onChange={e => setFormData({...formData, biography: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 transition-all font-medium resize-none"
            />
          </div>

        </section>

        {/* AI Behavior */}
        <section className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-[2.5rem] p-6 sm:p-10 space-y-10 shadow-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-orange-500">
              <Zap className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight">AI Behavior</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Response Length */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Response Length</label>
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                  {formData.responseLength === 'short' ? 'Concise' : formData.responseLength === 'medium' ? 'Balanced' : 'Detailed'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
                {['short', 'medium', 'long'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFormData({...formData, responseLength: val as any})}
                    className={cn(
                      "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      formData.responseLength === val 
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 font-medium ml-1 italic">
                {formData.responseLength === 'short' ? '1-2 punchy sentences.' : formData.responseLength === 'medium' ? 'Natural conversational flow.' : 'Deep, descriptive storytelling.'}
              </p>
            </div>

            {/* Creativity */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Creativity Level</label>
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                  {formData.creativity === 'low' ? 'Precise' : formData.creativity === 'medium' ? 'Balanced' : 'Wild'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
                {['low', 'medium', 'high'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFormData({...formData, creativity: val as any})}
                    className={cn(
                      "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      formData.creativity === val 
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 font-medium ml-1 italic">
                {formData.creativity === 'low' ? 'Stays strictly on topic.' : formData.creativity === 'medium' ? 'Creative but grounded.' : 'Unpredictable and imaginative.'}
              </p>
            </div>

            {/* Strictness */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Personality Adherence</label>
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                  {formData.strictness === 'flexible' ? 'Fluid' : formData.strictness === 'balanced' ? 'Stable' : 'Absolute'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
                {['flexible', 'balanced', 'strict'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFormData({...formData, strictness: val as any})}
                    className={cn(
                      "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      formData.strictness === val 
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 font-medium ml-1 italic">
                {formData.strictness === 'flexible' ? 'Can adapt to new roles.' : formData.strictness === 'balanced' ? 'Consistent personality.' : 'Never breaks character.'}
              </p>
            </div>

            {/* Tone */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Overall Tone</label>
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                  {formData.tone}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
                {['formal', 'casual', 'humorous', 'dramatic'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFormData({...formData, tone: val as any})}
                    className={cn(
                      "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      formData.tone === val 
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 font-medium ml-1 italic">
                Sets the general mood of the conversation.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row items-center gap-6 pt-6">
          <button 
            type="button"
            onClick={() => setFormData({...formData, isPublic: !formData.isPublic})}
            className={cn(
              "w-full sm:w-auto flex items-center gap-3 px-8 py-4 rounded-full font-black uppercase tracking-widest text-xs transition-all border",
              formData.isPublic 
                ? "bg-green-500/10 border-green-500/20 text-green-500" 
                : "bg-zinc-800 border-zinc-700 text-zinc-500"
            )}
          >
            {formData.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {formData.isPublic ? "Publicly Discoverable" : "Private Character"}
          </button>

          <button 
            type="button"
            onClick={() => setFormData({...formData, isNSFW: !formData.isNSFW})}
            className={cn(
              "w-full sm:w-auto flex items-center gap-3 px-8 py-4 rounded-full font-black uppercase tracking-widest text-xs transition-all border",
              formData.isNSFW 
                ? "bg-red-500/10 border-red-500/20 text-red-500" 
                : "bg-zinc-800 border-zinc-700 text-zinc-500"
            )}
          >
            <Zap className={cn("w-4 h-4", formData.isNSFW ? "fill-red-500" : "")} />
            {formData.isNSFW ? "NSFW Content" : "SFW Content"}
          </button>

          <button 
            disabled={loading}
            className="w-full sm:flex-1 bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-orange-500/30 disabled:opacity-50"
          >
            {loading ? "Forging..." : "Bring to Life"}
          </button>
        </div>
      </form>
    </div>
  );
};

const Chat = () => {
  const { characterId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Mark AI messages as read when they appear
  useEffect(() => {
    const unreadAiMessages = messages.filter(m => m.role === 'model' && !m.read);
    if (unreadAiMessages.length > 0 && chatId) {
      unreadAiMessages.forEach(msg => {
        updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), { read: true })
          .catch(err => console.error("Error marking message as read:", err));
      });
    }
  }, [messages, chatId]);

  const isFollowing = profile?.following?.includes(character?.creatorId || '');
  const isLiked = profile?.likedCharacters?.includes(character?.id || '');

  const toggleFollow = async () => {
    if (!user || !profile || !character) return;

    const creatorRef = doc(db, 'users', character.creatorId);
    const userRef = doc(db, 'users', user.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const creatorDoc = await transaction.get(creatorRef);
        if (!creatorDoc.exists()) return;

        const currentFollowers = creatorDoc.data().followersCount || 0;
        const newFollowing = isFollowing
          ? (profile.following || []).filter(id => id !== character.creatorId)
          : [...(profile.following || []), character.creatorId];

        transaction.update(userRef, { following: newFollowing });
        transaction.update(creatorRef, { 
          followersCount: isFollowing ? Math.max(0, currentFollowers - 1) : currentFollowers + 1 
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${character.creatorId}`);
    }
  };

  const toggleLike = async () => {
    if (!user || !profile || !character) return;

    const characterRef = doc(db, 'characters', character.id);
    const userRef = doc(db, 'users', user.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const charDoc = await transaction.get(characterRef);
        if (!charDoc.exists()) return;

        const currentLikes = charDoc.data().likesCount || 0;
        const newLikedCharacters = isLiked
          ? (profile.likedCharacters || []).filter(id => id !== character.id)
          : [...(profile.likedCharacters || []), character.id];

        transaction.update(userRef, { likedCharacters: newLikedCharacters });
        transaction.update(characterRef, { 
          likesCount: isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1 
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `characters/${character.id}`);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!user || !characterId) return;
    const ratingRef = doc(db, 'characters', characterId, 'ratings', user.uid);
    const unsubscribe = onSnapshot(ratingRef, (doc) => {
      if (doc.exists()) {
        setUserRating(doc.data().rating);
      }
    });
    return () => unsubscribe();
  }, [user, characterId]);

  const handleRate = async (rating: number) => {
    if (!user || !characterId) return;

    try {
      await runTransaction(db, async (transaction) => {
        const charRef = doc(db, 'characters', characterId);
        const ratingRef = doc(db, 'characters', characterId, 'ratings', user.uid);
        
        const charDoc = await transaction.get(charRef);
        const ratingDoc = await transaction.get(ratingRef);

        if (!charDoc.exists()) throw "Character does not exist!";

        const charData = charDoc.data() as Character;
        const oldRating = ratingDoc.exists() ? ratingDoc.data().rating : null;
        
        let newCount = charData.ratingCount || 0;
        let newTotal = (charData.averageRating || 0) * newCount;

        if (oldRating !== null) {
          // Update existing rating
          newTotal = newTotal - oldRating + rating;
        } else {
          // Add new rating
          newCount += 1;
          newTotal += rating;
        }

        const newAverage = newTotal / newCount;

        transaction.set(ratingRef, {
          characterId,
          userId: user.uid,
          rating,
          createdAt: serverTimestamp()
        });

        transaction.update(charRef, {
          averageRating: newAverage,
          ratingCount: newCount
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `characters/${characterId}/ratings`);
    }
  };

  const handleDeleteCharacter = async () => {
    if (!user || !characterId || !character || character.creatorId !== user.uid) return;
    
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'characters', characterId));
      navigate('/');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `characters/${characterId}`);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  useEffect(() => {
    if (!characterId) return;
    const getChar = async () => {
      const docSnap = await getDoc(doc(db, 'characters', characterId));
      if (docSnap.exists()) {
        setCharacter({ id: docSnap.id, ...docSnap.data() } as Character);
      }
    };
    getChar();
  }, [characterId]);

  useEffect(() => {
    if (!user || !characterId) return;

    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      where('characterId', '==', characterId),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Create new chat session
        const newChat = await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          characterId,
          characterName: character?.name || "Character",
          lastMessage: character?.firstMessage || "",
          updatedAt: serverTimestamp()
        });

        if (character?.firstMessage) {
          await addDoc(collection(db, 'chats', newChat.id, 'messages'), {
            chatId: newChat.id,
            senderId: 'ai',
            role: 'model',
            content: character.firstMessage,
            createdAt: serverTimestamp()
          });
        }
        setChatId(newChat.id);
      } else {
        setChatId(snapshot.docs[0].id);
      }
    });

    return () => unsubscribe();
  }, [user, characterId, character]);

  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !chatId || !character || sending) return;

    const userMsg = input.trim();
    setInput("");
    setSending(true);

    try {
      // Add user message
      const userMsgRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        role: 'user',
        content: userMsg,
        read: false,
        createdAt: serverTimestamp()
      });

      // Update chat session
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: userMsg,
        updatedAt: serverTimestamp()
      });

      // Get AI response
      const aiResponse = await getChatResponse(
        character,
        messages,
        userMsg
      );

      // Mark user message as read (AI "read" it)
      await updateDoc(userMsgRef, { read: true });

      // Add AI message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: 'ai',
        role: 'model',
        content: aiResponse,
        read: false,
        createdAt: serverTimestamp()
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `chats/${chatId}/messages`);
    } finally {
      setSending(false);
    }
  };

  if (!character) return null;

  return (
    <div className="h-[100dvh] flex bg-zinc-950 fixed inset-0 z-[60] overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-14 sm:h-16 border-b border-zinc-800 flex items-center px-3 sm:px-4 gap-3 sm:gap-4 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
          <button onClick={() => navigate('/')} className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setShowSidebar(!showSidebar)}>
            <img 
              src={character.avatarUrl || `https://picsum.photos/seed/${character.id}/100/100`} 
              alt="" 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-zinc-800 object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <h2 className="font-black text-white text-sm sm:text-base truncate uppercase tracking-tight">{character.name}</h2>
              <StarRating rating={character.averageRating} count={character.ratingCount} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={cn(
                "p-2 rounded-full transition-colors",
                showSidebar ? "bg-orange-500 text-white" : "text-zinc-400 hover:bg-zinc-800"
              )}
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 sm:space-y-8 relative scroll-smooth no-scrollbar">
          <div className="sticky top-0 z-20 flex justify-center pointer-events-none">
            <div className="pointer-events-auto mt-2 scale-90 sm:scale-100 origin-top">
              <RatingInput currentRating={userRating || 0} onRate={handleRate} />
            </div>
          </div>
          
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-50 p-8">
              <div className="w-24 h-24 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-800 flex items-center justify-center">
                <Ghost className="w-10 h-10 text-zinc-700" />
              </div>
              <div className="space-y-2">
                <p className="text-white font-black uppercase tracking-widest text-sm">Silence is golden</p>
                <p className="text-zinc-500 text-xs max-w-xs">Start a conversation with {character.name} to break the ice.</p>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
            {messages.map((msg, i) => (
              <div 
                key={msg.id || i} 
                className={cn(
                  "flex gap-3 sm:gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 mt-1">
                  {msg.role === 'user' ? (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-black text-xs sm:text-sm border-2 border-orange-400/20">
                      {user?.displayName?.[0] || 'U'}
                    </div>
                  ) : (
                    <img 
                      src={character.avatarUrl || `https://picsum.photos/seed/${character.id}/100/100`} 
                      alt="" 
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-zinc-800 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>

                <div className={cn(
                  "flex flex-col max-w-[85%] sm:max-w-[75%] relative",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      {msg.role === 'user' ? (user?.displayName || 'You') : character.name}
                    </span>
                    <span className="text-[9px] text-zinc-700 font-bold">
                      {msg.createdAt ? format(msg.createdAt.toDate(), 'h:mm a') : "just now"}
                    </span>
                  </div>
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm sm:text-base leading-relaxed shadow-2xl relative group/msg",
                    msg.role === 'user' 
                      ? "bg-orange-500 text-white rounded-tr-none" 
                      : "bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-tl-none"
                  )}>
                    <div className="markdown-body">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    
                    {/* Copy Button */}
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        setCopiedId(msg.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className={cn(
                        "absolute top-2 transition-all p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/70 hover:text-white",
                        msg.role === 'user' ? "right-full mr-2" : "left-full ml-2",
                        copiedId === msg.id ? "opacity-100 bg-green-500/20 text-green-400" : "opacity-0 group-hover/msg:opacity-100"
                      )}
                      title="Copy message"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Read Receipt (for user messages) */}
                  {msg.role === 'user' && (
                    <div className="mt-1 flex items-center gap-1 px-1">
                      {msg.read ? (
                        <CheckCheck className="w-3 h-3 text-orange-400" />
                      ) : (
                        <Check className="w-3 h-3 text-zinc-600" />
                      )}
                      <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-tighter">
                        {msg.read ? "Read" : "Sent"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {sending && (
              <div className="flex gap-3 sm:gap-4 animate-pulse">
                <div className="flex-shrink-0 mt-1">
                  <img 
                    src={character.avatarUrl || `https://picsum.photos/seed/${character.id}/100/100`} 
                    alt="" 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-zinc-800 object-cover opacity-50"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">{character.name} is typing</span>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} className="h-8" />
          </div>
        </div>

        <div className="p-3 sm:p-6 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-xl pb-safe">
          {!user ? (
            <div className="text-center p-6 bg-zinc-900 rounded-[2rem] border border-zinc-800 shadow-2xl">
              <p className="text-zinc-400 text-sm mb-4 font-medium">Sign in to join the conversation</p>
              <button 
                onClick={signInWithGoogle} 
                className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded-full font-black uppercase tracking-widest transition-all shadow-xl shadow-orange-500/20"
              >
                Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="max-w-4xl mx-auto relative group flex items-end gap-2">
              <div className="relative flex-1">
                <textarea 
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e as any);
                    }
                  }}
                  placeholder={`Message ${character.name}...`}
                  className="w-full bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-[1.5rem] py-4 sm:py-5 pl-6 pr-14 focus:outline-none focus:border-orange-500 transition-all text-sm sm:text-base shadow-2xl placeholder:text-zinc-600 resize-none overflow-y-auto no-scrollbar"
                />
                <button 
                  disabled={!input.trim() || sending}
                  className="absolute right-2 bottom-2 p-2.5 sm:p-3 bg-orange-500 text-white rounded-xl disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-orange-500/20"
                >
                  <Send className="w-4 h-4 sm:w-5 h-5" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Character Sidebar */}
      <div className={cn(
        "fixed inset-y-0 right-0 w-full sm:w-80 md:w-96 bg-zinc-900 border-l border-zinc-800 z-[70] transition-transform duration-500 ease-in-out shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col",
        showSidebar ? "translate-x-0" : "translate-x-full"
      )}>
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6">
          <h3 className="font-black uppercase tracking-widest text-sm text-zinc-400">Character Info</h3>
          <button onClick={() => setShowSidebar(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
          <div className="text-center space-y-4">
            <div className="relative inline-block">
              <img 
                src={character.avatarUrl || `https://picsum.photos/seed/${character.id}/200/200`} 
                alt="" 
                className="w-32 h-32 rounded-[2.5rem] border-4 border-zinc-800 object-cover shadow-2xl mx-auto"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white p-2 rounded-2xl shadow-xl">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">{character.name}</h2>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Link 
                  to={`/user/${character.creatorId}`}
                  className="text-xs text-zinc-500 font-bold uppercase tracking-widest hover:text-orange-500 transition-colors"
                >
                  Created by {character.creatorName || "Lumina"}
                </Link>
                {user && character.creatorId !== user.uid && (
                  <button 
                    onClick={toggleFollow}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                      isFollowing 
                        ? "bg-zinc-800 text-zinc-400 border border-zinc-700" 
                        : "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    )}
                  >
                    {isFollowing ? <UserMinus className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                    {isFollowing ? "Unfollow" : "Follow"}
                  </button>
                )}
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <StarRating rating={character.averageRating} count={character.ratingCount} size="md" />
              <div className="flex items-center gap-2 px-3 py-1 bg-zinc-950 rounded-full border border-zinc-800">
                <ThumbsUp className={cn("w-3 h-3", isLiked ? "text-orange-500 fill-orange-500" : "text-zinc-600")} />
                <span className="text-[10px] font-black text-zinc-400">{character.likesCount || 0}</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Biography</h4>
              <p className="text-sm text-zinc-400 leading-relaxed italic">
                {character.biography || character.personality}
              </p>
            </div>

            {character.scenario && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Scenario</h4>
                <p className="text-sm text-zinc-400 leading-relaxed italic">
                  {character.scenario}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-800 space-y-1">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Creativity</span>
                <p className="text-xs font-bold text-orange-500 uppercase">{character.creativity || 'Medium'}</p>
              </div>
              <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-800 space-y-1">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Strictness</span>
                <p className="text-xs font-bold text-orange-500 uppercase">{character.strictness || 'Balanced'}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-800 space-y-3">
              <button 
                onClick={() => setShowStoryModal(true)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 shadow-xl shadow-orange-500/20 border border-orange-400"
              >
                <Wand2 className="w-4 h-4" />
                Generate Story
              </button>

              <div className="flex gap-3">
                <button 
                  onClick={toggleLike}
                  className={cn(
                    "flex-1 py-4 rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 border",
                    isLiked 
                      ? "bg-orange-500 text-white border-orange-400 shadow-xl shadow-orange-500/20" 
                      : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                  )}
                >
                  <ThumbsUp className={cn("w-4 h-4", isLiked ? "fill-white" : "")} />
                  {isLiked ? "Liked" : "Like Bot"}
                </button>
                <button 
                  onClick={() => {
                    const url = `${window.location.origin}/chat/${character.id}`;
                    navigator.clipboard.writeText(url);
                    alert("Link copied to clipboard!");
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 border border-zinc-700"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>

              {user && character.creatorId === user.uid && (
                <>
                  {!showDeleteConfirm ? (
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white py-4 rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 border border-red-500/20 hover:border-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Character
                    </button>
                  ) : (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-[2rem] p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest text-center">Are you absolutely sure?</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleDeleteCharacter}
                          disabled={deleting}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50"
                        >
                          {deleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[65] sm:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      <StoryGeneratorModal 
        isOpen={showStoryModal} 
        onClose={() => setShowStoryModal(false)} 
        character={character} 
      />
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          const newProfile = {
            uid: u.uid,
            displayName: u.displayName,
            photoURL: u.photoURL,
            createdAt: serverTimestamp(),
            favorites: [],
            following: [],
            likedCharacters: [],
            followersCount: 0
          };
          await setDoc(docRef, newProfile);
        }
        
        profileUnsubscribe = onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          }
        });
      } else {
        setProfile(null);
        if (profileUnsubscribe) profileUnsubscribe();
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      <SearchContext.Provider value={{ search, setSearch }}>
        <Router>
          <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-orange-500/30">
            <Routes>
              <Route path="/" element={<><Navbar /><Home /></>} />
              <Route path="/history" element={<><Navbar /><History /></>} />
              <Route path="/stories" element={<><Navbar /><Stories /></>} />
              <Route path="/story/:storyId" element={<><Navbar /><StoryDetail /></>} />
              <Route path="/create" element={<><Navbar /><CreateCharacter /></>} />
              <Route path="/profile" element={<><Navbar /><Profile /></>} />
              <Route path="/user/:userId" element={<><Navbar /><PublicProfile /></>} />
              <Route path="/settings" element={<><Navbar /><SettingsPage /></>} />
              <Route path="/chat/:characterId" element={<Chat />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </Router>
      </SearchContext.Provider>
    </AuthContext.Provider>
  );
}
