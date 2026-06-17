// ProfessionalIcon.tsx – unified professional icon component

import React from 'react';
import { ComponentProps } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import { Octicons } from '@expo/vector-icons';
import { SimpleLineIcons } from '@expo/vector-icons';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: object;
};

type IconMapEntry = {
  component: React.ComponentType<ComponentProps<any>>;
  name: string;
};

// Map Ionicons names (used throughout the app) to professional equivalents.
const ICON_MAP: Record<string, IconMapEntry> = {
  // ── Navigation / core UI ─────────────────────────────────────────────────
  home:                    { component: MaterialIcons,          name: 'home' },
  'home-outline':          { component: MaterialCommunityIcons, name: 'home-outline' },
  compass:                 { component: MaterialCommunityIcons, name: 'compass' },
  'compass-outline':       { component: MaterialCommunityIcons, name: 'compass-outline' },
  calendar:                { component: MaterialIcons,          name: 'calendar-today' },
  'calendar-outline':      { component: MaterialCommunityIcons, name: 'calendar-outline' },
  people:                  { component: MaterialIcons,          name: 'people' },
  'people-outline':        { component: MaterialCommunityIcons, name: 'account-group-outline' },
  person:                  { component: MaterialIcons,          name: 'person' },
  'person-outline':        { component: MaterialCommunityIcons, name: 'account-outline' },

  // ── Header icons ──────────────────────────────────────────────────────────
  // Notifications — filled bell vs outlined bell
  notifications:           { component: MaterialIcons,          name: 'notifications' },
  'notifications-outline': { component: MaterialCommunityIcons, name: 'bell-outline' },

  // Messages / chat
  chatbubble:              { component: MaterialCommunityIcons, name: 'chat' },
  'chatbubble-outline':    { component: MaterialCommunityIcons, name: 'message-text-outline' },
  'chatbubbles-outline':   { component: MaterialCommunityIcons, name: 'forum-outline' },

  // ── Post input actions ───────────────────────────────────────────────────
  // Photo
  image:                   { component: MaterialCommunityIcons, name: 'image-plus' },
  'image-outline':         { component: MaterialCommunityIcons, name: 'image-outline' },
  // Video
  videocam:                { component: MaterialCommunityIcons, name: 'video-plus' },
  'videocam-outline':      { component: MaterialCommunityIcons, name: 'video-outline' },

  // ── Section title icons ───────────────────────────────────────────────────
  flame:                   { component: MaterialCommunityIcons, name: 'fire' },
  megaphone:               { component: MaterialCommunityIcons, name: 'bullhorn' },

  // ── Stats & analytics ────────────────────────────────────────────────────
  speedometer:             { component: MaterialCommunityIcons, name: 'speedometer' },
  'speedometer-outline':   { component: MaterialCommunityIcons, name: 'speedometer-medium' },
  analytics:               { component: MaterialCommunityIcons, name: 'chart-bar' },
  'analytics-outline':     { component: MaterialCommunityIcons, name: 'chart-areaspline' },

  // ── Common actions / status ───────────────────────────────────────────────
  'arrow-back':            { component: MaterialIcons,          name: 'arrow-back' },
  'arrow-forward':         { component: MaterialIcons,          name: 'arrow-forward' },
  'arrow-forward-circle':  { component: MaterialCommunityIcons, name: 'arrow-right-circle' },
  'chevron-forward':       { component: MaterialIcons,          name: 'chevron-right' },
  add:                     { component: MaterialIcons,          name: 'add' },
  close:                   { component: MaterialIcons,          name: 'close' },
  search:                  { component: MaterialIcons,          name: 'search' },
  filter:                  { component: MaterialCommunityIcons, name: 'filter-variant' },

  // ── Status / feedback ─────────────────────────────────────────────────────
  'checkmark-circle':      { component: MaterialCommunityIcons, name: 'check-circle' },
  'checkmark-done':        { component: MaterialCommunityIcons, name: 'check-circle-outline' },
  checkmark:               { component: MaterialIcons,          name: 'check' },
  'alert-circle':          { component: MaterialIcons,          name: 'error' },
  'alert-circle-outline':  { component: MaterialCommunityIcons, name: 'alert-circle-outline' },
  'information-circle':            { component: MaterialIcons,  name: 'info' },
  'information-circle-outline':    { component: MaterialCommunityIcons, name: 'information-outline' },
  'shield-checkmark':      { component: MaterialCommunityIcons, name: 'shield-check' },

  // ── Media / content ───────────────────────────────────────────────────────
  play:                    { component: MaterialIcons,          name: 'play-arrow' },
  camera:                  { component: MaterialIcons,          name: 'photo-camera' },
  'resize-outline':        { component: MaterialCommunityIcons, name: 'crop' },
  'document-text':         { component: MaterialCommunityIcons, name: 'file-document-outline' },
  'newspaper-outline':     { component: MaterialCommunityIcons, name: 'newspaper-variant-outline' },

  // ── Social ────────────────────────────────────────────────────────────────
  heart:                   { component: FontAwesome5,           name: 'heart' },
  'heart-outline':         { component: MaterialCommunityIcons, name: 'heart-outline' },
  star:                    { component: MaterialIcons,          name: 'star' },
  bookmark:                { component: MaterialIcons,          name: 'bookmark' },
  'bookmark-outline':      { component: MaterialCommunityIcons, name: 'bookmark-outline' },
  'share-outline':         { component: MaterialCommunityIcons, name: 'share-variant-outline' },
  'share-social-outline':  { component: MaterialCommunityIcons, name: 'share-variant' },
  'paper-plane':           { component: MaterialCommunityIcons, name: 'send' },
  'chatbubble-ellipses':   { component: MaterialCommunityIcons, name: 'message-processing' },
  'ellipsis-vertical':     { component: MaterialCommunityIcons, name: 'dots-vertical' },

  // ── Profile / user ────────────────────────────────────────────────────────
  'person-add':            { component: MaterialIcons,          name: 'person-add' },
  'create-outline':        { component: MaterialCommunityIcons, name: 'pencil-outline' },
  'log-out-outline':       { component: MaterialCommunityIcons, name: 'logout' },

  // ── Location / misc ───────────────────────────────────────────────────────
  location:                { component: MaterialIcons,          name: 'location-on' },
  'location-outline':      { component: MaterialCommunityIcons, name: 'map-marker-outline' },
  hourglass:               { component: MaterialCommunityIcons, name: 'hourglass' },
  'time-outline':          { component: MaterialCommunityIcons, name: 'clock-outline' },
  trophy:                  { component: MaterialCommunityIcons, name: 'trophy' },
  fitness:                 { component: MaterialCommunityIcons, name: 'dumbbell' },
  'barbell-outline':       { component: MaterialCommunityIcons, name: 'dumbbell' },

  // ── Brands / logos ────────────────────────────────────────────────────────
  'logo-google':           { component: AntDesign,              name: 'google' },
  'logo-apple':            { component: AntDesign,              name: 'apple1' },
  'logo-facebook':         { component: AntDesign,              name: 'facebook-square' },

  // ── Fallback ──────────────────────────────────────────────────────────────
  default:                 { component: MaterialIcons,          name: 'help-outline' },
};

export function ProfessionalIcon({ name, size = 24, color, style }: IconProps) {
  const entry = ICON_MAP[name] ?? ICON_MAP['default'];
  const IconComponent = entry.component;
  return <IconComponent name={entry.name} size={size} color={color} style={style} />;
}


