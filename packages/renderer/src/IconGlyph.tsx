import * as React from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Bell,
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  Clock,
  Code,
  Coffee,
  Cpu,
  Crown,
  Database,
  Flame,
  Gift,
  Globe,
  GraduationCap,
  Headphones,
  Heart,
  Laptop,
  Lightbulb,
  Mail,
  MapPin,
  Megaphone,
  Music,
  Percent,
  Phone,
  Pizza,
  Play,
  Quote,
  Rocket,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  Target,
  ThumbsUp,
  Trophy,
  User,
  Users,
  Utensils,
  Video,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@workspace/motion";

/**
 * Renders an icon layer.
 *
 * The map is explicit rather than a dynamic lookup so the set of icons a
 * project document can name is closed at build time — a hostile document
 * cannot reach for an arbitrary export — and so bundlers can tree-shake.
 */
const ICONS: Record<IconName, LucideIcon> = {
  sparkles: Sparkles,
  star: Star,
  heart: Heart,
  zap: Zap,
  flame: Flame,
  award: Award,
  crown: Crown,
  gift: Gift,
  rocket: Rocket,
  trophy: Trophy,
  target: Target,
  bell: Bell,
  tag: Tag,
  percent: Percent,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  calendar: Calendar,
  clock: Clock,
  "map-pin": MapPin,
  phone: Phone,
  mail: Mail,
  globe: Globe,
  users: Users,
  user: User,
  check: Check,
  "check-circle": CheckCircle,
  "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight,
  play: Play,
  music: Music,
  camera: Camera,
  video: Video,
  code: Code,
  cpu: Cpu,
  database: Database,
  wifi: Wifi,
  smartphone: Smartphone,
  laptop: Laptop,
  headphones: Headphones,
  coffee: Coffee,
  utensils: Utensils,
  pizza: Pizza,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  lightbulb: Lightbulb,
  megaphone: Megaphone,
  "thumbs-up": ThumbsUp,
  quote: Quote,
};

export function getIconComponent(name: string): LucideIcon {
  return ICONS[name as IconName] ?? Sparkles;
}

export function IconGlyph({
  name,
  color,
  strokeWidth,
}: {
  name: IconName | string;
  color: string;
  strokeWidth: number;
}) {
  const Icon = getIconComponent(name);
  // Sized to the parent box so the icon scales with the layer transform.
  return <Icon width="100%" height="100%" color={color} strokeWidth={strokeWidth} absoluteStrokeWidth />;
}
