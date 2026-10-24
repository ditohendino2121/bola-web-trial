"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDB, Crest } from "../../../../components/ui";
import Icon from "../../../../components/Icon";
import { supa } from "../../../../lib/supa";
import { loadMatch, mergeMatch } from "../../../../lib/data";
import { teamNama, urutkanPosisi } from "../../../../lib/rules";

// Tampilan layar besar (proyektor/TV): skor, line up, pencetak gol. Tanpa menu.
// Live lewat Supabase Realtime (migration_liga_v5.sql); cadangan cek ringan tiap 5 detik.
export default function LayarSkor() {
  const params = useParams() as any;
  const matchId = params.matchId as string;
  const { db, error, setDb } = useDB();
  const [live, setLive] = useState(false);

  useEffect(() => {
    let aktif = true;
    const segarkan = async () => {
      try {
        const { match, stats } = await loadMatch(matchId);
        if (aktif) setDb((prev) => (prev ? mergeMatch(prev, matchId, match, stats) : prev));
      } catch { /* koneksi putus sesaat — coba lagi di putaran berikutnya */ }
    };
    let channel: ReturnType<ReturnType<typeof supa>["channel"]> | null = null;
    try {
      channel = supa()
        .channel(`layar-${matchId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "league_matches", filter: `id=eq.${matchId}` }, segarkan)
        .on("postgres_changes", { event: "*", schema: "public", table: "league_player_stats", filter: `match_id=eq.${matchId}` }, segarkan)
        .subscribe((st) => { if (aktif) setLive(st === "SUBSCRIBED"); });
    } catch { /* env kosong — tetap pakai polling */ }
    const id = setInterval(segarkan, 5000);
    return () => { aktif = false; clearInterval(id); if (channel) supa().removeChannel(channel); };
  }, [matchId, setDb]);

  if (error) return <div className="layar"><p className="layar-msg">{error}</p></div>;
  if (!db) return <div className="layar"><p className="layar-msg">Memuat...</p></div>;
  const match = db.matches.find((m) => m.id === matchId);
  if (!match) return <div className="layar"><p className="layar-msg">Laga tidak ditemukan. Buka halaman ini sambil login.</p></div>;

  const edisi = db.editions.find((e) => e.id === match.edition_id);
  const stats = db.playerStats.filter((p) => p.match_id === matchId);
  const golOf = (uid: string) => stats.find((p) => p.user_id === uid)?.gol || 0;
  const namaOf = (uid: string) => db.users.find((u) => u.id === uid)?.nama || uid;
  const skor = match.sh !== null && match.sa !== null;
  const imbang = skor && match.sh === match.sa;

  const sisi = (team: string) => {
    const lineup = urutkanPosisi(db.teams[team] || []);
    const pencetak = lineup.filter((m) => golOf(m.userId) > 0);
    return (
      <div className="layar-side">
        <Crest team={team} size="lg" />
        <div className="layar-team">{teamNama(team)}</div>
        <div className="layar-scorers">
          {pencetak.map((m) => <div key={m.userId}><Icon name="ball" /> {namaOf(m.userId)} {golOf(m.userId) > 1 ? `(${golOf(m.userId)})` : ""}</div>)}
        </div>
        <div className="layar-lineup">
          {lineup.map((m) => (
            <div key={m.userId}><span className="layar-pos">{m.posisi === "GK" ? "GK" : m.posisi.slice(0, 3).toUpperCase()}</span> {namaOf(m.userId)}</div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="layar">
      <div className="layar-top">
        <span>{edisi?.label || "KIM x DnA Health League"} {live && <span className="layar-live">LIVE</span>}</span>
        <button className="layar-fs" onClick={() => document.documentElement.requestFullscreen?.()}>Layar penuh</button>
      </div>
      <div className="layar-main">
        {sisi(match.home)}
        <div className="layar-center">
          <div className="layar-score">{skor ? `${match.sh} - ${match.sa}` : "vs"}</div>
          {imbang && match.penalti_pemenang && <div className="layar-note">Adu penalti: {teamNama(match.penalti_pemenang)} menang</div>}
          {imbang && !match.penalti_pemenang && <div className="layar-note">Adu penalti</div>}
        </div>
        {sisi(match.away)}
      </div>
    </div>
  );
}
