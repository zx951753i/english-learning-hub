import Link from "next/link";
import { Stars } from "@/components/adventure/stars";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { formatDue } from "@/features/missions/rules";
import { formatDuration, formatWhen, type loadStudentRecord } from "@/features/records/data";
import { StatusBadge } from "../../assignments/status-badge";

type Record = Awaited<ReturnType<typeof loadStudentRecord>>;

export function LearningRecord({ studentId, record }: { studentId: string; record: Record }) {
  const { summary } = record;
  const stats = [
    { label: "完成關卡", value: `${summary.levels}`, unit: "關" },
    { label: "星星", value: `${summary.stars}`, unit: "顆" },
    { label: "正確率", value: summary.accuracy === null ? "—" : `${summary.accuracy}`, unit: summary.accuracy === null ? "" : "%" },
    { label: "練習時間", value: `${summary.minutes}`, unit: "分鐘" },
  ];

  return (
    <>
      <Card>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl">學習紀錄</h2>
          <p className="text-sm text-muted">
            {summary.lastActive ? `最近一次：${formatWhen(summary.lastActive)}` : "還沒有作答紀錄"}・共 {summary.sessions} 局、
            {summary.answers} 題
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-control bg-cream px-3 py-2.5">
              <dt className="text-sm text-muted">{stat.label}</dt>
              <dd className="font-serif text-2xl font-semibold text-navy">
                {stat.value}
                <span className="ml-1 font-sans text-sm font-normal text-muted">{stat.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
        {record.badges.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">徽章</span>
            {record.badges.map((name) => (
              <Badge key={name}>{name}</Badge>
            ))}
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-3 text-xl">最近的作答（{record.sessions.length}）</h2>
        {record.sessions.length === 0 ? (
          <EmptyState title="還沒有作答紀錄" />
        ) : (
          <ul className="divide-y divide-line">
            {record.sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/teacher/students/${studentId}/sessions/${session.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 hover:bg-sky/30"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{session.title}</span>
                    <span className="block text-sm text-muted">
                      {formatWhen(session.completedAt)}・{session.game}・{session.mode}・{formatDuration(session.seconds)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {session.stars !== null ? <Stars count={session.stars} size={16} /> : null}
                    <span className="min-w-[4.5rem] text-right">
                      <span className="font-serif text-lg font-semibold text-navy">{session.score}</span>
                      <span className="text-sm text-muted"> 分</span>
                      <span className="block text-xs text-muted">
                        {session.correct} / {session.total} 題
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-xl">錯題本（{record.mistakes.length}）</h2>
        <p className="mb-3 text-sm text-muted">學生答錯、還沒連續答對 2 次的題目。</p>
        {record.mistakes.length === 0 ? (
          <EmptyState title="錯題本是空的" />
        ) : (
          <ul className="divide-y divide-line">
            {record.mistakes.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block font-medium">{item.label}</span>
                  <span className="block text-sm text-muted">{item.unit}</span>
                </span>
                <span className="shrink-0 text-sm text-danger">錯 {item.wrong} 次</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {record.tasks.length > 0 ? (
        <Card>
          <h2 className="mb-3 text-xl">指派的任務</h2>
          <ul className="divide-y divide-line">
            {record.tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/teacher/assignments/${task.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 hover:bg-sky/30"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{task.levelTitle}</span>
                    <span className="block text-sm text-muted">
                      {task.targetName}
                      {task.due_on ? `・期限 ${formatDue(task.due_on)}` : ""}
                    </span>
                  </span>
                  {task.progress ? <StatusBadge status={task.progress.status} /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
