import {
  Building2,
  CheckSquare,
  FileText,
  Globe,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Menu,
  MessageSquare,
  Palette,
  Puzzle,
  ScrollText,
  Settings,
  TriangleAlert,
  Trash2,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

/** The icon set of the consoles (Lucide, as on the MK DevWorks site). They take the text colour of whatever holds them. */
const draw = (Icon: LucideIcon): ReactNode => <Icon className="h-4 w-4" aria-hidden="true" />;

export const ICONS = {
  dashboard: draw(LayoutDashboard),
  organizations: draw(Building2),
  audit: draw(ScrollText),
  settings: draw(Settings),
  crew: draw(Users),
  members: draw(UserRound),
  deletion: draw(Trash2),
  documents: draw(FileText),
  docTypes: draw(ListChecks),
  announcements: draw(Megaphone),
  todos: draw(CheckSquare),
  feedback: draw(MessageSquare),
  finance: draw(Wallet),
  callit: draw(TriangleAlert),
  modules: draw(Puzzle),
  branding: draw(Palette),
  domains: draw(Globe),
  menu: draw(Menu),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;
