"use client";

import { useEffect, useState } from "react";
import { formatNumber, formatScore, formatSigned } from "@/lib/format";
import type { BlocAggregate, CrowdPartyView, CrowdView, HistogramBin } from "@/lib/crowd";

export function CrowdLive({ initial, pollUrl }: { initial: CrowdView; pollUrl: string }) {
  const [view, setView] = useState(initial);

  useEffect(() => {
    setView(initial);
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(pollUrl);
        if (!response.ok || cancelled) return;
        const next = (await response.json()) as CrowdView;
        if (!cancelled) setView(next);
      } catch {
        /* keep the last aggregate */
      }
    };
    const kick = window.setTimeout(load, 800);
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [pollUrl]);

  return <CrowdBoard view={view} />;
}

export function CrowdBoard({ view }: { view: CrowdView }) {
  if (!view.visible) {
    return (
      <div className="mt-6 rounded-xl bg-card px-4 py-4 text-sm leading-relaxed ring-1 ring-foreground/10">
        {view.reason === "lock" ? (
          <p>חוכמת ההמונים תופיע אחרי נעילת הניחושים. עד אז לא מציגים סיכום.</p>
        ) : (
          <p>
            הסיכום מופיע מ-{formatNumber(view.minBets)} ניחושים שלמים
            {view.sampleSize != null ? `, ויש כרגע ${formatNumber(view.sampleSize)}` : ""}. מתחת לסף הזה אפשר היה לשחזר
            ניחוש של אדם אחד, אז לא מציגים ממוצע, חציון או התפלגות.
          </p>
        )}
      </div>
    );
  }

  const hasActual = view.parties.some((party) => party.actual != null);

  return (
    <div className="mt-6 space-y-8">
      <p className="text-sm text-muted-foreground">
        מתוך {formatNumber(view.sampleSize ?? 0)} ניחושים שלמים. רואים רק סיכום.
        {hasActual ? " אחרי התוצאות, «בפועל» הוא קו אדום על התחזית." : ""}
      </p>

      <section className="space-y-3">
        <h2 className="font-heading text-3xl">גושים</h2>
        {view.blocs.length === 0 ? (
          <p className="text-sm text-muted-foreground">מנהל האתר עוד לא הגדיר גושים, אז אין חישוב של 61 מנדטים.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {view.blocs.map((bloc) => (
              <BlocCard key={bloc.blocId} bloc={bloc} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-3xl">רשימות</h2>
        <ul className="space-y-3">
          {view.parties.map((party) => (
            <li key={party.partyId}>
              <PartyCard party={party} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function BlocCard({ bloc }: { bloc: BlocAggregate }) {
  return (
    <article className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-2xl leading-none">{bloc.name}</h3>
        <p className="text-end">
          <span className="block font-heading text-3xl tabular-nums leading-none">{formatScore(bloc.mean)}</span>
          <span className="text-xs text-muted-foreground">ממוצע מושבים</span>
        </p>
      </div>
      <MajorityBar percent={bloc.majorityPercent} />
      <p className="text-sm">
        {formatNumber(bloc.majorityPercent)}% מהניחושים נותנים לגוש 61 או יותר.
      </p>
      <p className="text-sm text-muted-foreground">
        חציון {formatScore(bloc.median)} · טווח {formatScore(bloc.q1)}–{formatScore(bloc.q3)}
      </p>
      {bloc.actual != null ? (
        <p className="text-sm">
          בפועל {formatNumber(bloc.actual)}
          {bloc.actualMajority ? " · יש רוב" : " · אין רוב"}
          <span className="text-muted-foreground"> · מול הממוצע {formatSigned(bloc.actual - bloc.mean)}</span>
        </p>
      ) : null}
    </article>
  );
}

function MajorityBar({ percent }: { percent: number }) {
  return (
    <div className="space-y-1">
      <div className="h-2 overflow-hidden rounded-full bg-muted" dir="ltr">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground" dir="ltr">
        <span>0%</span>
        <span>61 מנדטים</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function PartyCard({ party }: { party: CrowdPartyView }) {
  const scale = Math.max(40, party.q3, party.mean, party.actual ?? 0, 4);
  return (
    <article className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-medium">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: party.color }} />
            <span className="truncate">{party.name}</span>
            {party.ballot ? <span className="text-sm text-muted-foreground">{party.ballot}</span> : null}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(party.passPercent)}% צופים שעוברת את אחוז החסימה
          </p>
        </div>
        <p className="text-end">
          <span className="block font-heading text-3xl tabular-nums leading-none">{formatScore(party.mean)}</span>
          <span className="text-xs text-muted-foreground">ממוצע</span>
        </p>
      </div>
      <RangeTrack party={party} scale={scale} />
      <p className="text-sm text-muted-foreground">
        חציון {formatScore(party.median)} · מחצית הניחושים בין {formatScore(party.q1)} ל-{formatScore(party.q3)}
        {party.actual != null ? ` · בפועל ${formatNumber(party.actual)}` : ""}
      </p>
      <Histogram bins={party.histogram} color={party.color} />
    </article>
  );
}

function RangeTrack({ party, scale }: { party: CrowdPartyView; scale: number }) {
  const left = (value: number) => `${Math.max(0, Math.min(100, (value / scale) * 100))}%`;
  const width = `${Math.max(0, ((party.q3 - party.q1) / scale) * 100)}%`;
  return (
    <div className="relative h-6" dir="ltr">
      <div className="absolute inset-x-0 top-2 h-2 rounded-full bg-muted" />
      <div className="absolute top-2 h-2 rounded-full bg-primary/30" style={{ left: left(party.q1), width }} />
      <span className="absolute top-1.5 size-3 -translate-x-1/2 rounded-full bg-primary" style={{ left: left(party.median) }} />
      {party.actual != null ? (
        <span
          className="absolute top-0 h-6 w-0.5 -translate-x-1/2 bg-[#9c3b2e]"
          style={{ left: left(party.actual) }}
          title="בפועל"
        />
      ) : null}
    </div>
  );
}

function Histogram({ bins, color }: { bins: HistogramBin[]; color: string }) {
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  return (
    <div>
      <div className="flex h-16 items-end gap-0.5" dir="ltr" aria-hidden="true">
        {bins.map((bin) => (
          <div key={`${bin.from}-${bin.to}`} className="flex h-full flex-1 items-end">
            <div
              className="w-full rounded-sm"
              style={{ height: `${Math.max(bin.count === 0 ? 0 : 8, (bin.count / max) * 100)}%`, background: color }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground" dir="ltr">
        <span>{bins[0] ? formatNumber(bins[0].from) : "0"}</span>
        <span>{bins.length > 0 ? formatNumber(bins[bins.length - 1].to) : ""}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">כל עמודה היא טווח מושבים, והגובה הוא כמה ניחושים נפלו בו.</p>
    </div>
  );
}
