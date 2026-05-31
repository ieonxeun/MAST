import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { supabase, PROOF_BUCKET } from "./supabaseClient.js";

/* ================================================================== *
 * MAST 에타 홍보 게시글 관리 시스템 — Supabase 연결 버전
 * ================================================================== */

const todayStr = () => new Date().toISOString().slice(0, 10);
const keyOf = (m) => `${m.name}|${m.gi}|${m.school}`;
const shortSchool = (s) => s.replace(/대학교.*$/, "대").replace(/ㅇs.*$/, "").slice(0, 6);

const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE || "MAST2026";
const ST = { NONE: "none", PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" };

const C = {
  ink: "#1f2d44", ink2: "#2c3550", sub: "#5d6678", sub2: "#6b86b3", hint: "#8a96ab",
  line: "#d8e0ec", blue: "#5a86c9", blueDeep: "#2f5fa3", blueSoft: "#e1ebf9", blueSoft2: "#dde9fa",
  done: "#0f8a66", doneSoft: "#e0f3ec", warn: "#9a5e16", warnSoft: "#f5e8cd",
  miss: "#a32d2d", missSoft: "#fbe6e6", rose: "#c0506a",
  white78: "rgba(255,255,255,0.78)", white70: "rgba(255,255,255,0.7)",
};
const FONT = '-apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const PAGE_BG = "linear-gradient(160deg,#e8eff9 0%,#f1ecf6 45%,#f6f1e9 100%)";

export default function EtaPromotionApp() {
  const [session, setSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem("mast_session");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const handleLogin = (s) => {
    sessionStorage.setItem("mast_session", JSON.stringify(s));
    setSession(s);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("mast_session");
    setSession(null);
  };
  return (
    <div style={{ minHeight: "100vh", background: PAGE_BG, fontFamily: FONT, color: C.ink }}>
      <Blobs />
      <div style={{ position: "relative", maxWidth: 880, margin: "0 auto", padding: "0 20px 64px" }}>
        {!session ? <Login onLogin={handleLogin} /> : (
          <>
            <TopBar session={session} onLogout={handleLogout} />
            {session.role === "admin" ? <AdminPage session={session} /> : <MemberPage session={session} />}
          </>
        )}
      </div>
    </div>
);
}

function Blobs() {
  const blob = (s) => ({ position: "fixed", borderRadius: "50%", filter: "blur(3px)", pointerEvents: "none", zIndex: 0, ...s });
  return (
    <>
      <div style={blob({ width: 190, height: 190, right: -50, top: 40, background: "radial-gradient(circle at 35% 30%,#d2e1f6,#a7c2ea 60%,#dde4cc 100%)", opacity: 0.6 })} />
      <div style={blob({ width: 120, height: 120, left: -40, bottom: 120, background: "radial-gradient(circle at 40% 35%,#eaf0db,#c4d5ee 70%)", opacity: 0.55 })} />
      <div style={blob({ width: 60, height: 60, right: 120, bottom: 80, background: "radial-gradient(circle at 40% 35%,#fcf6df,#cfe0f7 75%)", opacity: 0.6, filter: "blur(1px)" })} />
    </>
  );
}

function Login({ onLogin }) {
  const [name, setName] = useState("");
  const [gi, setGi] = useState("");
  const [school, setSchool] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      const n = name.trim(), g = gi.trim(), s = school.trim();
      const { data, error } = await supabase.from("members").select("name, gi, school").eq("name", n);
      if (error) throw error;
      const norm = (x) => x.replace(/\s/g, "");
      const m = (data || []).find((row) => norm(row.gi) === norm(g) && norm(row.school) === norm(s));
      if (!m) { setErr("명단에서 찾을 수 없습니다. 이름·기수·학교를 정확히 입력해 주세요."); return; }
      const role = code.trim() === ADMIN_CODE ? "admin" : "member";
      if (code.trim() && role !== "admin") { setErr("관리자 코드가 올바르지 않습니다. (비우면 부원으로 로그인)"); return; }
      onLogin({ member: m, role });
    } catch (e) { setErr("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."); console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 400, margin: "8vh auto 0", position: "relative", zIndex: 1 }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.sub2 }}>MAST 홍보운영팀</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.ink, margin: "5px 0 0", letterSpacing: -0.5 }}>에타 홍보 게시글 관리</h1>
        <p style={{ fontSize: 13, fontWeight: 500, color: C.sub, marginTop: 8 }}>이름 · 기수 · 학교를 입력해 로그인하세요</p>
      </div>
      <div style={glassCard()}>
        <Field label="이름"><input style={input()} value={name} placeholder="예: 김민서" onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="기수"><input style={input()} value={gi} placeholder="예: 2기" onChange={(e) => setGi(e.target.value)} /></Field>
        <Field label="학교"><input style={input()} value={school} placeholder="예: 가천대학교" onChange={(e) => setSchool(e.target.value)} /></Field>
        <Field label="관리자 코드 (선택)">
          <div style={{ position: "relative" }}>
            <input style={{ ...input(), paddingRight: 44 }} type={showCode ? "text" : "password"} value={code} placeholder="운영진만 입력 · 비우면 부원으로"
              onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            <button type="button" onClick={() => setShowCode(v => !v)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.hint, fontSize: 16, padding: 0, lineHeight: 1 }}>
              {showCode ? "🙈" : "👁️"}
            </button>
          </div>
        </Field>
        {err && <div style={{ background: C.missSoft, color: C.miss, fontSize: 13, fontWeight: 600, padding: "10px 12px", borderRadius: 10, marginBottom: 6 }}>{err}</div>}
        <button style={primaryBtn({ width: "100%", marginTop: 6, opacity: loading ? 0.6 : 1 })} disabled={loading} onClick={submit}>
          {loading ? "확인 중..." : "로그인"}
        </button>
      </div>
      <p style={{ fontSize: 11, fontWeight: 500, color: C.hint, textAlign: "center", marginTop: 14 }}>MAST 홍보운영팀 · 에타 홍보 인증 시스템</p>
    </div>
  );
}

function TopBar({ session, onLogout }) {
  const isAdmin = session.role === "admin";
  return (
    <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "26px 0 22px" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.sub2 }}>MAST 홍보운영팀</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.ink, letterSpacing: -0.5, lineHeight: 1.18 }}>에타 홍보 {isAdmin ? "관리" : "게시글 관리"}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.white70, backdropFilter: "blur(10px)", border: "0.5px solid rgba(255,255,255,0.9)", padding: "7px 13px", borderRadius: 999 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{session.member.name}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: isAdmin ? "#fff" : C.blueDeep, background: isAdmin ? C.blue : C.blueSoft2, padding: "2px 8px", borderRadius: 999 }}>{isAdmin ? "관리자" : "부원"}</span>
        </div>
        <button style={ghostBtn()} onClick={onLogout}>로그아웃</button>
      </div>
    </div>
  );
}

function MemberPage({ session }) {
  const today = todayStr();
  const myKey = keyOf(session.member);
  const [mission, setMission] = useState(null);
  const [proofsByKey, setProofsByKey] = useState({});
  const [assigneeMembers, setAssigneeMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: mData } = await supabase.from("missions").select("*").eq("date", today).maybeSingle();
    setMission(mData || null);
    const { data: pData } = await supabase.from("proofs").select("*").eq("date", today);
    const byKey = {}; (pData || []).forEach((p) => { byKey[p.member_key] = p; });
    setProofsByKey(byKey);
    if (mData?.assignees?.length) {
      const { data: mem } = await supabase.from("members").select("*");
      const set = new Set(mData.assignees);
      setAssigneeMembers((mem || []).filter((m) => set.has(keyOf(m))));
    } else { setAssigneeMembers([]); }
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const isAssignee = !!mission && mission.assignees?.includes(myKey);
  const myProof = proofsByKey[myKey];
  if (loading) return <Loading />;

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      {!mission ? (
        <div style={{ ...glassCard(), textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>오늘 등록된 홍보 미션이 없습니다</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.sub, marginTop: 6 }}>관리자가 미션을 등록하면 이곳에 표시됩니다.</div>
        </div>
      ) : (
        <div style={glassCard()}>
          <span style={pill(C.blueDeep, C.blueSoft)}>오늘의 홍보 미션</span>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 13, color: C.ink, letterSpacing: -0.3 }}>{mission.title}</div>
          {mission.body && <p style={{ fontSize: 13, fontWeight: 500, color: C.sub, margin: "7px 0 0", lineHeight: 1.6 }}>{mission.body}</p>}
          {mission.deadline && <span style={{ display: "inline-block", marginTop: 13, fontSize: 11, fontWeight: 700, color: C.warn, background: C.warnSoft, padding: "5px 11px", borderRadius: 8 }}>마감 {mission.deadline}</span>}
          <div style={{ marginTop: 20, padding: 17, borderRadius: 16, background: "linear-gradient(120deg,#eef3fb,#e7edf6)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.sub2, marginBottom: 12 }}>오늘 담당자 · 전 부원 공개</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              {assigneeMembers.length === 0 ? (
                <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>지정된 담당자가 없습니다.</span>
              ) : assigneeMembers.map((m) => {
                const mine = keyOf(m) === myKey;
                const approved = proofsByKey[keyOf(m)]?.status === ST.APPROVED;
                return (
                  <span key={keyOf(m)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 16, fontWeight: 800, color: mine ? C.blueDeep : C.ink2, background: "#fff", border: mine ? "1.5px solid #9dbdec" : "1.5px solid transparent", padding: "10px 16px", borderRadius: 14 }}>
                    {m.name}
                    <span style={{ fontWeight: 600, color: C.hint, fontSize: 12 }}>{shortSchool(m.school)}</span>
                    {approved && <span style={{ color: C.done }}>✓</span>}
                    {mine && <span style={{ fontSize: 11, fontWeight: 700, color: C.blueDeep }}>· 나</span>}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 16, fontWeight: 800, margin: "26px 0 12px", color: C.ink }}>내 인증</div>
      {!mission ? (
        <div style={{ ...glassCard(0.6), textAlign: "center", fontSize: 14, fontWeight: 600, color: C.sub }}>오늘 미션이 없습니다.</div>
      ) : !isAssignee ? (
        <div style={{ ...glassCard(0.6), textAlign: "center", padding: 26 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#3a4356" }}>오늘 담당자가 아닙니다</div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#7886a0", margin: "8px 0 0", lineHeight: 1.6 }}>인증 업로드 권한은 그날 지정된 담당자에게만 있어요.<br />위에서 오늘 담당자를 확인할 수 있습니다.</p>
        </div>
      ) : myProof && myProof.status !== ST.REJECTED ? (
        <MyProofCard proof={myProof} />
      ) : (
        <UploadForm myKey={myKey} today={today} rejected={myProof?.status === ST.REJECTED} existingId={myProof?.id} onDone={load} />
      )}
    </div>
  );
}

async function runChecks(file, today) {
  const result = { format: false, duplicate: false, dateToday: null, hash: "" };
  result.format = /^image\//.test(file.type);
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let h = 0;
  for (let i = 0; i < bytes.length; i += Math.max(1, Math.floor(bytes.length / 4096))) h = (h * 31 + bytes[i]) >>> 0;
  result.hash = `${file.size}-${h}`;
  const { data } = await supabase.from("proofs").select("check_result");
  result.duplicate = (data || []).some((row) => row.check_result?.hash === result.hash);
  try { result.dateToday = extractExifDateMatchesToday(bytes, today); } catch { result.dateToday = null; }
  return result;
}

function extractExifDateMatchesToday(bytes, today) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const text = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 200000)));
  const m = text.match(/(\d{4}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}` === today;
}

function checkSummary(check) {
  if (!check) return { tone: "warn", label: "검증 정보 없음" };
  if (!check.format) return { tone: "miss", label: "이미지 형식 아님" };
  if (check.duplicate) return { tone: "miss", label: "중복 캡처" };
  if (check.dateToday === false) return { tone: "warn", label: "촬영일 오늘 아님" };
  if (check.dateToday === null) return { tone: "warn", label: "촬영일 확인불가" };
  return { tone: "done", label: "검증 통과" };
}

function UploadForm({ myKey, today, rejected, existingId, onDone }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [check, setCheck] = useState(null);
  const [link, setLink] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setCheck(await runChecks(f, today));
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const blocked = check && (!check.format || check.duplicate);
  const summary = check ? checkSummary(check) : null;

  const submit = async () => {
    if (!file || blocked) return;
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeKey = encodeURIComponent(myKey).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
      const randomId = Math.random().toString(36).slice(2, 8);
      const path = `${today}/${safeKey}_${Date.now()}_${randomId}.${ext}ㄹ
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(path);
      const row = {
        date: today, member_key: myKey, image_url: pub.publicUrl,
        link: link || null, memo: memo || null, check_result: check,
        status: ST.PENDING, submitted_at: new Date().toISOString(),
      };
      if (existingId) {
        const { error } = await supabase.from("proofs").update(row).eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("proofs").upsert(row, { onConflict: "date,member_key" });
        if (error) throw error;
      }
      await onDone();
    } catch (e) { alert("업로드 중 오류가 발생했습니다. 다시 시도해 주세요."); console.error(e); }
    finally { setBusy(false); }
  };

  return (
    <div style={glassCard()}>
      {rejected && <div style={{ background: C.missSoft, color: C.miss, fontSize: 13, fontWeight: 700, padding: "10px 12px", borderRadius: 10, marginBottom: 14 }}>이전 인증이 반려되었습니다. 다시 업로드해 주세요.</div>}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub2, marginBottom: 6 }}>에타 게시글 캡처 (필수)</div>
      {!preview ? (
        <div onClick={() => fileRef.current?.click()} style={{ border: "1.5px dashed #aebfd9", borderRadius: 14, padding: 24, textAlign: "center", color: "#7886a0", fontWeight: 600, fontSize: 13, background: "#f8faff", cursor: "pointer" }}>캡처 이미지를 올려주세요</div>
      ) : (
        <img src={preview} alt="캡처 미리보기" style={{ width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 14, border: `1px solid ${C.line}` }} />
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
      {summary && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={pill(toneInk(summary.tone), toneBg(summary.tone), 11)}>{summary.label}</span>
          <button style={{ ...ghostBtn(), padding: "6px 12px" }} onClick={() => fileRef.current?.click()}>다시 선택</button>
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <Field label="게시글 링크 (선택)"><input style={input()} value={link} placeholder="https://everytime.kr/..." onChange={(e) => setLink(e.target.value)} /></Field>
        <Field label="메모 (선택)"><input style={input()} value={memo} placeholder="게시판 / 내용 등" onChange={(e) => setMemo(e.target.value)} /></Field>
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: "#7886a0", lineHeight: 1.6, marginBottom: 12 }}>
        <span style={{ color: C.blueDeep, fontWeight: 700 }}>자동 검증:</span> 형식·중복·촬영일(오늘) 확인 → 통과 시 <b>검토 대기</b>로 접수, 관리자 승인 후 수행으로 인정됩니다.
      </div>
      <button style={primaryBtn({ width: "100%", opacity: preview && !blocked && !busy ? 1 : 0.5 })} disabled={!preview || blocked || busy} onClick={submit}>
        {busy ? "업로드 중..." : blocked ? "검증 실패 — 다른 캡처를 올려주세요" : "인증 제출 (검토 대기로 접수)"}
      </button>
    </div>
  );
}

function MyProofCard({ proof }) {
  const pending = proof.status === ST.PENDING;
  const summary = checkSummary(proof.check_result);
  return (
    <div style={{ ...glassCard(), borderColor: pending ? C.warnSoft : C.doneSoft }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={pill(pending ? C.warn : C.done, pending ? C.warnSoft : C.doneSoft)}>{pending ? "검토 대기" : "수행 인정 완료"}</span>
        <span style={pill(toneInk(summary.tone), toneBg(summary.tone), 11)}>{summary.label}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.hint, marginLeft: "auto" }}>{fmt(proof.submitted_at)}</span>
      </div>
      {proof.image_url && <img src={proof.image_url} alt="인증 캡처" style={{ width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 14, border: `1px solid ${C.line}` }} />}
      {proof.link && <div style={{ fontSize: 13, fontWeight: 500, marginTop: 8 }}>링크: <a href={proof.link} target="_blank" rel="noreferrer" style={{ color: C.blue }}>{proof.link}</a></div>}
      {proof.memo && <div style={{ fontSize: 13, fontWeight: 500, color: C.sub, marginTop: 4 }}>메모: {proof.memo}</div>}
      {pending && <p style={{ fontSize: 12, fontWeight: 500, color: C.sub, marginTop: 10 }}>관리자 승인 후 최종 수행으로 인정됩니다.</p>}
    </div>
  );
}

function AdminPage({ session }) {
  const today = todayStr();
  const [tab, setTab] = useState("status");
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMission = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("missions").select("*").eq("date", today).maybeSingle();
    setMission(data || null);
    setLoading(false);
  }, [today]);

  useEffect(() => { loadMission(); }, [loadMission]);
  useEffect(() => { if (!loading && !mission) setTab("mission"); }, [loading, mission]);

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        <Tab active={tab === "mission"} onClick={() => setTab("mission")}>미션 등록</Tab>
        <Tab active={tab === "status"} onClick={() => setTab("status")}>당일 현황</Tab>
        <Tab active={tab === "rank"} onClick={() => setTab("rank")}>누적 미수행</Tab>
        <Tab active={tab === "history"} onClick={() => setTab("history")}>과거 기록</Tab>
      </div>
      {loading ? <Loading /> : (
        <>
          {tab === "mission" && <MissionForm session={session} today={today} existing={mission} onSaved={async () => { await loadMission(); setTab("status"); }} />}
          {tab === "status" && <StatusBoard today={today} mission={mission} />}
          {tab === "rank" && <MissRank />}
          {tab === "history" && <HistoryPage />}
        </>
      )}
    </div>
  );
}

function MissionForm({ session, today, existing, onSaved }) {
  const [title, setTitle] = useState(existing?.title || "");
  const [body, setBody] = useState(existing?.body || "");
  const [deadline, setDeadline] = useState(existing?.deadline || "23:59");
  const [selected, setSelected] = useState(new Set(existing?.assignees || []));
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.from("members").select("*").then(({ data }) => setMembers(data || [])); }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return members;
    return members.filter((m) => m.name.includes(q) || m.school.includes(q) || m.gi.includes(q));
  }, [query, members]);

  const toggle = (k) => setSelected((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const save = async () => {
    setBusy(true);
    try {
      const row = { date: today, title: title.trim(), body: body.trim() || null, deadline, assignees: [...selected], created_by: session.member.name };
      const { error } = await supabase.from("missions").upsert(row, { onConflict: "date" });
      if (error) throw error;
      await onSaved();
    } catch (e) { alert("미션 저장 중 오류가 발생했습니다."); console.error(e); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <SectionTitle>오늘의 미션 등록</SectionTitle>
      <div style={glassCard()}>
        <Field label="미션 제목"><input style={input()} value={title} placeholder="예: 신입 모집 홍보글 게시" onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="미션 내용 (선택)"><textarea style={{ ...input(), height: 72, resize: "vertical", paddingTop: 10 }} value={body} placeholder="게시판 지정, 문구 가이드 등" onChange={(e) => setBody(e.target.value)} /></Field>
        <Field label="마감 시각"><input style={{ ...input(), width: 150 }} type="time" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        <Field label={`담당자 지정 (${selected.size}명 선택됨)`}><input style={input()} value={query} placeholder="이름 / 학교 / 기수로 검색" onChange={(e) => setQuery(e.target.value)} /></Field>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button style={ghostBtn()} onClick={() => setSelected(new Set(members.map(keyOf)))}>전체 선택</button>
          <button style={ghostBtn()} onClick={() => setSelected(new Set())}>전체 해제</button>
        </div>
        <div style={{ maxHeight: 260, overflow: "auto", border: `1px solid ${C.line}`, borderRadius: 12, background: "#fff" }}>
          {filtered.map((m) => {
            const k = keyOf(m); const on = selected.has(k);
            return (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: "1px solid #eef1f6", cursor: "pointer", background: on ? C.blueSoft : "transparent", fontSize: 14 }}>
                <input type="checkbox" checked={on} onChange={() => toggle(k)} />
                <span style={{ fontWeight: 700 }}>{m.name}</span>
                <span style={{ color: C.hint, fontSize: 13, fontWeight: 500 }}>{m.gi} · {m.school}</span>
              </label>
            );
          })}
        </div>
        <button style={primaryBtn({ width: "100%", marginTop: 16, opacity: title.trim() && selected.size && !busy ? 1 : 0.5 })} disabled={!title.trim() || !selected.size || busy} onClick={save}>
          {busy ? "저장 중..." : "미션 등록 · 전 부원에게 공개"}
        </button>
      </div>
    </div>
  );
}

function StatusBoard({ today, mission }) {
  const [members, setMembers] = useState([]);
  const [proofsByKey, setProofsByKey] = useState({});
  const [zoom, setZoom] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: mem } = await supabase.from("members").select("*");
    setMembers(mem || []);
    const { data: pData } = await supabase.from("proofs").select("*").eq("date", today);
    const byKey = {}; (pData || []).forEach((p) => { byKey[p.member_key] = p; });
    setProofsByKey(byKey);
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  if (!mission) return <div style={{ ...glassCard(), textAlign: "center", fontSize: 14, fontWeight: 600, color: C.sub }}>오늘 등록된 미션이 없습니다. ‘미션 등록’ 탭에서 먼저 등록하세요.</div>;
  if (loading) return <Loading />;

  const assignees = mission.assignees.map((k) => members.find((m) => keyOf(m) === k)).filter(Boolean);
  const stOf = (m) => proofsByKey[keyOf(m)]?.status || ST.NONE;
  const approved = assignees.filter((m) => stOf(m) === ST.APPROVED).length;
  const pending = assignees.filter((m) => stOf(m) === ST.PENDING).length;
  const rate = assignees.length ? Math.round((approved / assignees.length) * 100) : 0;

  const decide = async (memberKey, status) => {
    const p = proofsByKey[memberKey];
    if (!p) return;
    await supabase.from("proofs").update({ status }).eq("id", p.id);
    await load();
  };

  const markMiss = async () => {
    if (!confirm("미인증·반려·대기 상태인 담당자의 누적 미수행을 +1 합니다. 진행할까요?")) return;
    for (const m of assignees) {
      if (stOf(m) === ST.APPROVED) continue;
      const k = keyOf(m);
      const { data: cur } = await supabase.from("miss_counts").select("count").eq("member_key", k).maybeSingle();
      const next = (cur?.count || 0) + 1;
      await supabase.from("miss_counts").upsert({ member_key: k, count: next }, { onConflict: "member_key" });
    }
    alert("마감 처리가 완료되었습니다.");
  };

  return (
    <div>
      <SectionTitle>{mission.title} — 당일 현황</SectionTitle>
      <div style={{ display: "flex", gap: 9, marginBottom: 18 }}>
        <Metric label="담당" value={`${assignees.length}명`} />
        <Metric label="수행" value={`${approved}명`} color={C.done} />
        <Metric label="대기" value={`${pending}명`} color={C.warn} />
        <Metric label="인증률" value={`${rate}%`} color={C.blueDeep} />
      </div>
      <div style={{ ...glassCard(0.82), padding: 0, overflow: "hidden" }}>
        {assignees.map((m, i) => {
          const p = proofsByKey[keyOf(m)]; const st = p?.status || ST.NONE;
          const summary = p ? checkSummary(p.check_result) : null;
          return (
            <div key={keyOf(m)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 16px", borderTop: i ? "0.5px solid #e4e8f0" : "none", background: st === ST.PENDING ? "#fdf9f0" : "transparent", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{m.name}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: C.hint }}>{m.gi} · {m.school}</div>
              </div>
              {st === ST.NONE && <span style={pill(C.miss, C.missSoft, 11)}>미인증</span>}
              {st === ST.REJECTED && <span style={pill(C.miss, C.missSoft, 11)}>반려됨</span>}
              {summary && st !== ST.NONE && <span style={pill(toneInk(summary.tone), toneBg(summary.tone), 10)}>{summary.label}</span>}
              {p && <button style={{ ...ghostBtn(), padding: "6px 10px" }} onClick={() => setZoom(p)}>캡처 보기</button>}
              {st === ST.APPROVED && <span style={pill("#fff", C.done, 11)}>수행</span>}
              {st === ST.PENDING && (
                <>
                  <button style={miniBtn(C.blueDeep)} onClick={() => decide(keyOf(m), ST.APPROVED)}>승인</button>
                  <button style={miniBtn(C.miss)} onClick={() => decide(keyOf(m), ST.REJECTED)}>반려</button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <button style={dangerBtn({ marginTop: 16 })} onClick={markMiss}>마감 처리 · 미수행자 누적 미수행 +1</button>
      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, background: "rgba(30,30,50,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 16, maxWidth: 520, width: "100%" }}>
            <img src={zoom.image_url} alt="인증 캡처" style={{ width: "100%", borderRadius: 10 }} />
            {zoom.link && <a href={zoom.link} target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 13, fontWeight: 500 }}>{zoom.link}</a>}
            {zoom.memo && <div style={{ fontSize: 13, fontWeight: 500, color: C.sub, marginTop: 4 }}>메모: {zoom.memo}</div>}
            <button style={ghostBtn({ width: "100%", marginTop: 12 })} onClick={() => setZoom(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MissRank() {
  const THRESHOLD = 3;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: counts } = await supabase.from("miss_counts").select("*").gt("count", 0).order("count", { ascending: false });
      const { data: mem } = await supabase.from("members").select("*");
      const byKey = {}; (mem || []).forEach((m) => { byKey[keyOf(m)] = m; });
      setRows((counts || []).map((c) => ({ m: byKey[c.member_key], c: c.count })).filter((r) => r.m));
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <SectionTitle>누적 미수행 랭킹</SectionTitle>
      {rows.length === 0 ? (
        <div style={{ ...glassCard(), textAlign: "center", fontSize: 14, fontWeight: 600, color: C.sub }}>아직 누적된 미수행 기록이 없습니다.</div>
      ) : (
        <div style={{ ...glassCard(0.82), padding: 0, overflow: "hidden" }}>
          {rows.map((r, i) => {
            const flagged = r.c >= THRESHOLD;
            return (
              <div key={keyOf(r.m)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i ? "0.5px solid #e4e8f0" : "none", background: flagged ? C.missSoft : "transparent" }}>
                <span style={{ width: 22, fontWeight: 700, color: C.hint, fontSize: 13 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{r.m.name}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: C.hint }}>{r.m.gi} · {r.m.school}</div>
                </div>
                {flagged && <span style={pill(C.miss, "#fff", 11)}>지속 미수행</span>}
                <span style={{ fontSize: 16, fontWeight: 800, color: flagged ? C.miss : C.ink }}>{r.c}회</span>
              </div>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 12, fontWeight: 500, color: C.sub, marginTop: 12 }}>누적 미수행 {THRESHOLD}회 이상이면 ‘지속 미수행’으로 자동 표시됩니다.</p>
    </div>
  );
}

function HistoryPage() {
  const [dates, setDates] = useState([]);
  const [selDate, setSelDate] = useState("");
  const [mission, setMission] = useState(null);
  const [proofs, setProofs] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("missions").select("date, title").order("date", { ascending: false });
      setDates(data || []);
      setLoading(false);
    })();
  }, []);

  const loadDetail = async (date) => {
    setSelDate(date); setDetailLoading(true);
    const { data: m } = await supabase.from("missions").select("*").eq("date", date).maybeSingle();
    const { data: p } = await supabase.from("proofs").select("*").eq("date", date);
    const { data: mem } = await supabase.from("members").select("*");
    setMission(m || null); setProofs(p || []); setMembers(mem || []);
    setDetailLoading(false);
  };

  if (loading) return <Loading />;

  const proofsByKey = {};
  proofs.forEach((p) => { proofsByKey[p.member_key] = p; });
  const assignees = mission ? (mission.assignees || []).map((k) => members.find((m) => keyOf(m) === k)).filter(Boolean) : [];
  const approved = assignees.filter((m) => proofsByKey[keyOf(m)]?.status === ST.APPROVED).length;

  return (
    <div>
      <SectionTitle>과거 미션 기록</SectionTitle>
      <div style={{ ...glassCard(0.82), padding: 0, overflow: "hidden", marginBottom: 18 }}>
        {dates.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 14, color: C.sub }}>기록이 없습니다.</div>}
        {dates.map((d, i) => (
          <div key={d.date} onClick={() => loadDetail(d.date)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderTop: i ? "0.5px solid #e4e8f0" : "none", cursor: "pointer", background: selDate === d.date ? C.blueSoft : "transparent" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{d.date}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.sub }}>{d.title}</div>
            </div>
            <span style={{ fontSize: 12, color: C.sub2, fontWeight: 700 }}>▶</span>
          </div>
        ))}
      </div>

      {selDate && (
        detailLoading ? <Loading /> : !mission ? (
          <div style={{ ...glassCard(), textAlign: "center", fontSize: 14, color: C.sub }}>미션 정보를 불러올 수 없습니다.</div>
        ) : (
          <div>
            <SectionTitle>{mission.date} · {mission.title}</SectionTitle>
            <div style={{ display: "flex", gap: 9, marginBottom: 18 }}>
              <Metric label="담당" value={`${assignees.length}명`} />
              <Metric label="수행" value={`${approved}명`} color={C.done} />
              <Metric label="인증률" value={`${assignees.length ? Math.round(approved / assignees.length * 100) : 0}%`} color={C.blueDeep} />
            </div>
            <div style={{ ...glassCard(0.82), padding: 0, overflow: "hidden" }}>
              {assignees.map((m, i) => {
                const p = proofsByKey[keyOf(m)]; const st = p?.status || ST.NONE;
                const summary = p ? checkSummary(p.check_result) : null;
                return (
                  <div key={keyOf(m)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 16px", borderTop: i ? "0.5px solid #e4e8f0" : "none", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 110 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{m.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: C.hint }}>{m.gi} · {m.school}</div>
                    </div>
                    {st === ST.NONE && <span style={pill(C.miss, C.missSoft, 11)}>미인증</span>}
                    {st === ST.REJECTED && <span style={pill(C.miss, C.missSoft, 11)}>반려됨</span>}
                    {summary && st !== ST.NONE && <span style={pill(toneInk(summary.tone), toneBg(summary.tone), 10)}>{summary.label}</span>}
                    {p && <button style={{ ...ghostBtn(), padding: "6px 10px" }} onClick={() => setZoom(p)}>캡처 보기</button>}
                    {st === ST.APPROVED && <span style={pill("#fff", C.done, 11)}>수행</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, background: "rgba(30,30,50,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 16, maxWidth: 520, width: "100%" }}>
            <img src={zoom.image_url} alt="인증 캡처" style={{ width: "100%", borderRadius: 10 }} />
            {zoom.link && <a href={zoom.link} target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 13, fontWeight: 500 }}>{zoom.link}</a>}
            {zoom.memo && <div style={{ fontSize: 13, fontWeight: 500, color: C.sub, marginTop: 4 }}>메모: {zoom.memo}</div>}
            <button style={ghostBtn({ width: "100%", marginTop: 12 })} onClick={() => setZoom(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}


function Loading() {
  return <div style={{ ...glassCard(), textAlign: "center", fontSize: 14, fontWeight: 600, color: C.sub, position: "relative", zIndex: 1 }}>불러오는 중...</div>;
}
function fmt(iso) { try { return new Date(iso).toLocaleString("ko-KR"); } catch { return ""; } }
function SectionTitle({ children }) { return <h2 style={{ fontSize: 16, fontWeight: 800, color: C.ink, margin: "0 0 12px" }}>{children}</h2>; }
function Field({ label, children }) { return <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 700, color: C.sub2, marginBottom: 6 }}>{label}</div>{children}</div>; }
function Metric({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: C.white78, border: "0.5px solid rgba(255,255,255,0.95)", borderRadius: 14, padding: 13 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || C.ink, marginTop: 3 }}>{value}</div>
    </div>
  );
}
function Tab({ active, children, onClick }) {
  return <button onClick={onClick} style={{ border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 13, fontWeight: active ? 800 : 700, color: active ? "#fff" : "#7886a0", background: active ? "#2a3550" : "rgba(255,255,255,0.55)", padding: "8px 15px", borderRadius: 999 }}>{children}</button>;
}
function pill(fg, bg, fs = 11) { return { display: "inline-block", fontSize: fs, fontWeight: 700, color: fg, background: bg, padding: "4px 10px", borderRadius: 999 }; }
const toneInk = (t) => (t === "done" ? C.done : t === "warn" ? C.warn : C.miss);
const toneBg = (t) => (t === "done" ? C.doneSoft : t === "warn" ? C.warnSoft : C.missSoft);
function glassCard(opacity = 0.78) {
  return { background: `rgba(255,255,255,${opacity})`, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "0.5px solid rgba(255,255,255,0.95)", borderRadius: 22, padding: 22, boxShadow: "0 10px 32px rgba(110,140,190,0.15)" };
}
function input() { return { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, fontWeight: 600, fontFamily: FONT, color: C.ink, background: "#fff", outline: "none" }; }
function baseBtn(extra) { return { border: "none", borderRadius: 14, padding: "14px 16px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT, ...extra }; }
function primaryBtn(extra) { return baseBtn({ color: "#fff", background: "linear-gradient(95deg,#5a86c9,#7ba0d8)", boxShadow: "0 6px 18px rgba(90,134,201,0.3)", ...extra }); }
function dangerBtn(extra) { return baseBtn({ color: "#fff", background: C.rose, padding: "13px 18px", fontSize: 14, ...extra }); }
function ghostBtn(extra) { return { border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.6)", color: C.sub, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, ...extra }; }
function miniBtn(color) { return { border: "none", borderRadius: 999, padding: "5px 13px", fontSize: 11, fontWeight: 800, color: "#fff", background: color, cursor: "pointer", fontFamily: FONT }; }
