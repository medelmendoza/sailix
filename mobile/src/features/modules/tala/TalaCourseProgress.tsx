import { View } from 'react-native';
import { AppText, ProgressBar } from '@/components';
import { colors, spacing } from '@/constants/theme';
import type { TalaCourse } from '@/services/api/types';
import { dueInfo, type Due } from './stats';
import { useBrand } from '@/theme/brand';

const TONE: Record<Due['tone'], string> = {
  done: colors.success,
  overdue: colors.danger,
  soon: colors.warning,
  ok: colors.textMuted,
  upcoming: colors.textMuted,
};

const STATE: Record<TalaCourse['state'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
};

export type CourseProgressData = Pick<
  TalaCourse,
  'name' | 'completed' | 'total' | 'percent' | 'state' | 'date_from' | 'date_to'
>;

/** Progress bar, "n of total", state and due date of one course: the same everywhere a course is summarized. */
export function TalaCourseProgress({
  course,
  showState = true,
  showDue = true,
  showPercent = false,
}: {
  course: CourseProgressData;
  showState?: boolean;
  showDue?: boolean;
  /** A "Progress  27%" line above the bar. */
  showPercent?: boolean;
}) {
  const brand = useBrand();
  const due = dueInfo(course);
  return (
    <View style={{ gap: spacing.xs }}>
      {showPercent ? (
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <AppText variant="caption" muted>
            Progress
          </AppText>
          <AppText style={{ fontFamily: 'Quicksand_700Bold', color: brand.primary }}>
            {course.percent}%
          </AppText>
        </View>
      ) : null}
      <ProgressBar percent={course.percent} label={`${course.name} progress`} />
      <AppText variant="caption" muted>
        {course.completed} of {course.total} items completed
        {showState ? ` · ${STATE[course.state]}` : ''}
      </AppText>
      {showDue && due ? (
        <AppText variant="caption" style={{ color: TONE[due.tone] }}>
          {due.text}
          {due.tone !== 'done' && course.date_to ? ` · due ${course.date_to}` : ''}
        </AppText>
      ) : null}
    </View>
  );
}
