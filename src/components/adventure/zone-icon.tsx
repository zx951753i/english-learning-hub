import {
  Archive, BookOpen, Castle, Crown, FlaskConical, Hammer, House, Landmark, Mountain,
  RadioTower, Spline, Swords, Tent, Trees, Waves, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  forest: Trees,
  cave: Mountain,
  village: House,
  castle: Castle,
  lake: Waves,
  tower: BookOpen,
  boss: Crown,
  dungeon: Swords,
  lab: FlaskConical,
  bridge: Spline,
  station: RadioTower,
  academy: Landmark,
  archive: Archive,
  workshop: Hammer,
  practice: Tent,
};

export function ZoneIcon({ theme, size = 20 }: { theme: string; size?: number }) {
  const Icon = ICONS[theme] ?? Tent;
  return <Icon size={size} aria-hidden />;
}
