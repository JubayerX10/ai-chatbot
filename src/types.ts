import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  age?: number;
  favorites?: string[];
  following?: string[];
  likedCharacters?: string[];
  followersCount?: number;
  createdAt: Timestamp;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  personality: string;
  appearance?: string;
  speechStyle?: string;
  firstMessage?: string;
  scenario?: string;
  biography?: string;
  creatorId: string;
  creatorName: string;
  avatarUrl: string;
  isPublic: boolean;
  averageRating?: number;
  ratingCount?: number;
  likesCount?: number;
  responseLength?: 'short' | 'medium' | 'long';
  creativity?: 'low' | 'medium' | 'high';
  strictness?: 'flexible' | 'balanced' | 'strict';
  tone?: 'formal' | 'casual' | 'humorous' | 'dramatic';
  tags?: string[];
  isNSFW?: boolean;
  createdAt: Timestamp;
}

export interface ChatSession {
  id: string;
  userId: string;
  characterId: string;
  characterName: string;
  characterAvatarUrl?: string;
  lastMessage: string;
  updatedAt: Timestamp;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: Timestamp;
}

export interface Rating {
  id: string;
  characterId: string;
  userId: string;
  rating: number; // 1-5
  createdAt: Timestamp;
}
