/** The four background sounds. Each clip is five minutes and is repeated until the chosen time is up (spec 3.3, BR-51). */
export type Sound = {
  id: 'brown' | 'rain' | 'water' | 'insects';
  category: 'Focus' | 'Rest';
  title: string;
  image: number;
  audio: number;
};

export const SOUNDS: readonly Sound[] = [
  {
    id: 'brown',
    category: 'Focus',
    title: 'Brown noise',
    image: require('../../../assets/astra/images/brown.jpg'),
    audio: require('../../../assets/astra/sounds/brown-noise-5.mp3'),
  },
  {
    id: 'rain',
    category: 'Rest',
    title: 'Rain',
    image: require('../../../assets/astra/images/rain.jpg'),
    audio: require('../../../assets/astra/sounds/rain-5.mp3'),
  },
  {
    id: 'water',
    category: 'Rest',
    title: 'Water',
    image: require('../../../assets/astra/images/water.jpg'),
    audio: require('../../../assets/astra/sounds/water-5.mp3'),
  },
  {
    id: 'insects',
    category: 'Rest',
    title: 'Insects',
    image: require('../../../assets/astra/images/insects.jpg'),
    audio: require('../../../assets/astra/sounds/insects-5.mp3'),
  },
];

/** 5 minutes (one play), then 30 to 240 in steps of 30. */
export const DURATIONS_MIN = [5, 30, 60, 90, 120, 150, 180, 210, 240] as const;

export const findSound = (id: string) => SOUNDS.find((s) => s.id === id);

/** `H:MM:SS` or `M:SS` for a number of seconds. */
export function playTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
