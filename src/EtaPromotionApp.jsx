import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, PROOF_BUCKET } from "./supabaseClient.js";
import mastLogo from "./assets/mast-logo.svg";
import megaphoneImg from "./assets/megaphone.png";
import cameraImg from "./assets/camera.png";
import successCheckImg from "./assets/success-check.png";
import sirenImg from "./assets/siren.png";

var ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE || "mast2026!";
var MISSION_BUCKET = "missions";

function todayKST() {
  var now = new Date();
  var kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return kst.getFullYear() + "-" + String(kst.getMonth() + 1).padStart(2, "0") + "-" + String(kst.getDate()).padStart(2, "0");
}
function keyOf(m) { return m.name + "|" + m.gi + "|" + m.school; }
function normalize(s) { return (s || "").replace(/\s/g, "").toLowerCase(); }
function schoolMatch(input, dbSchool) {
  var a = normalize(input), b = normalize(dbSchool);
  return a === b || b.startsWith(a) || a.startsWith(b);
}
function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }); }
  catch(e) { return iso; }
}
function fmtTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }); }
  catch(e) { return ""; }
}

var ST = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" };
// "반려"는 UI 라벨에서 사라지고 "미완료"로 통합. 부원 상세에서만 특이사항으로 표시.
var stLabel = function(s) { return s === ST.APPROVED ? "인증 완료" : s === ST.PENDING ? "제출됨" : "미완료"; };
var stColor = function(s) { return s === ST.APPROVED ? "#10A26A" : s === ST.PENDING ? "#3B72E8" : "#E04848"; };
var stBg   = function(s) { return s === ST.APPROVED ? "#E6F8EF" : s === ST.PENDING ? "#E8F0FE" : "#FDECEC"; };
var stNote = function(s) {
  if (s === ST.APPROVED) return "관리자 승인 완료";
  if (s === ST.PENDING) return "제출 후 검토 대기";
  if (s === ST.REJECTED) return "사진 반려됨 (재업로드 필요)";
  return "아직 제출 안 함";
};

var BG = "linear-gradient(180deg, #F8FAFF 0%, #F4F7FF 55%, #FFFDF8 100%)";
var BLUE = "#3B72E8";
var INK = "#1A2340";
var SUB = "#6B7895";
var FONT = '-apple-system, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

export default function App() {
  var _s = useState(function() {
    try { var v = sessionStorage.getItem("mast_eta_v4"); return v ? JSON.parse(v) : null; } catch(e) { return null; }
  });
  var session = _s[0], setSession = _s[1];

  function login(s) { sessionStorage.setItem("mast_eta_v4", JSON.stringify(s)); setSession(s); }
  function logout() { sessionStorage.removeItem("mast_eta_v4"); setSession(null); }

  if (!session) return <LoginPage onLogin={login} />;
  if (session.role === "admin") return <AdminApp session={session} onLogout={logout} />;
  return <MemberApp session={session} onLogout={logout} />;
}

/* ════════════════════════════════════════════════
   LOGIN (레퍼런스 시안 그대로)
═══════════════════════════════════════════════════ */
function LoginPage(props) {
  var _n = useState(""), name = _n[0], setName = _n[1];
  var _g = useState(""), gi = _g[0], setGi = _g[1];
  var _sc = useState(""), school = _sc[0], setSchool = _sc[1];
  var _c = useState(""), code = _c[0], setCode = _c[1];
  var _sh = useState(false), showCode = _sh[0], setShowCode = _sh[1];
  var _e = useState(""), err = _e[0], setErr = _e[1];
  var _l = useState(false), loading = _l[0], setLoading = _l[1];

  // 화면 너비 감지 (반응형)
  var _w = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  var winW = _w[0], setWinW = _w[1];
  useEffect(function() {
    function onResize() { setWinW(window.innerWidth); }
    window.addEventListener("resize", onResize);
    return function() { window.removeEventListener("resize", onResize); };
  }, []);
  var isDesktop = winW >= 768;

  async function submit() {
    setErr(""); setLoading(true);
    try {
      var hasCode = code.trim().length > 0;
      var hasFields = name.trim() && gi.trim() && school.trim();

      if (hasCode && !hasFields) {
        if (code.trim() === ADMIN_CODE) {
          props.onLogin({ member: { name: "관리자", gi: "-", school: "-" }, role: "admin" });
          return;
        }
        setErr("관리자 코드가 올바르지 않습니다."); return;
      }
      if (!hasFields) { setErr("이름·기수·학교를 입력하거나, 관리자 코드만 입력해 주세요."); return; }

      var res = await supabase.from("members").select("name, gi, school").eq("name", name.trim());
      if (res.error) throw res.error;
      var m = (res.data || []).find(function(row) {
        return normalize(row.gi) === normalize(gi) && schoolMatch(school, row.school);
      });
      if (!m) { setErr("명단에서 찾을 수 없습니다. 이름·기수·학교를 다시 확인해 주세요."); return; }

      var role = hasCode && code.trim() === ADMIN_CODE ? "admin" : "member";
      if (hasCode && role !== "admin") { setErr("관리자 코드가 올바르지 않습니다."); return; }

      props.onLogin({ member: m, role: role });
    } catch(e) { setErr("오류가 발생했습니다. 잠시 후 다시 시도해 주세요."); console.error(e); }
    finally { setLoading(false); }
  }

  // 공통 콘텐츠 (카드 안/풀스크린 안에 똑같이 들어감)
  var content = (
    <>
      <img src={mastLogo} alt="MAST" style={{ height: 48, marginBottom: 10 }} />
      <div style={{ fontSize: 13, color: "#8093B8", marginBottom: 2, fontWeight: 500 }}>University Student</div>
      <div style={{ fontSize: 13, color: "#8093B8", marginBottom: 14, fontWeight: 500 }}>Academic Alliance</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginBottom: 6, letterSpacing: -0.5 }}>홍보 활동 인증 시스템</div>

      <div style={{ marginTop: 0, marginBottom: 4, display: "flex", justifyContent: "center", position: "relative" }}>
        <img src={megaphoneImg} alt="" style={{ width: "100%", maxWidth: isDesktop ? 380 : 340, height: "auto", filter: "drop-shadow(0 20px 28px rgba(60,100,200,0.22))", animation: "floaty 4s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", width: "50%", height: 14, background: "radial-gradient(ellipse, rgba(60,100,200,0.22) 0%, transparent 70%)", filter: "blur(5px)" }} />
      </div>
      <style>{"@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}"}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        <IconInput icon={<IconUser />} value={name} onChange={setName} placeholder="이름을 입력하세요" />
        <IconInput icon={<IconCap />} value={gi} onChange={setGi} placeholder="기수를 입력하세요 (예: 26기)" />
        <IconInput icon={<IconSchool />} value={school} onChange={setSchool} placeholder="학교를 입력하세요 (예: 홍익대학교)" />
        <IconInput
          icon={<IconLock />} value={code} onChange={setCode} type={showCode ? "text" : "password"}
          placeholder="관리자 코드를 입력하세요 (선택사항)"
          right={
            <button type="button" onClick={function() { setShowCode(function(v) { return !v; }); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: SUB, display: "flex", alignItems: "center" }}>
              {showCode ? <IconEyeOff /> : <IconEye />}
            </button>
          }
          onEnter={submit}
        />
      </div>

      {err && <div style={{ background: "#FDECEC", color: "#C0392B", fontSize: 13, fontWeight: 600, padding: "11px 14px", borderRadius: 12, marginBottom: 12 }}>{err}</div>}

      <button style={btnPrimary({ opacity: loading ? 0.7 : 1, borderRadius: 16, padding: "16px 0" })} disabled={loading} onClick={submit}>
        {loading ? "확인 중..." : "로그인"}
      </button>
      <div style={{ fontSize: 12, color: "#8A96AB", marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        관리자 코드는 관리자에게 문의하세요. <IconHelp />
      </div>
      <div style={{ fontSize: 11, color: "#A8B2C5", marginTop: 8, lineHeight: 1.5 }}>
        ※ 세부 캠퍼스(예: 세종캠퍼스)는 학교명만 입력해도 됩니다.
      </div>
    </>
  );

  // 데스크탑: 화면 중앙 카드 + 카드 밖에 큰 배경 구슬
  if (isDesktop) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #EEF4FC 0%, #DCE6F5 60%, #CDDCF2 100%)", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
        {/* 카드 밖 큰 배경 구슬들 */}
        {/* 좌측 */}
        <Orb style={{ width: 220, height: 220, left: "6%", top: "8%" }} />
        <SaturnOrb style={{ width: 240, left: "3%", top: "38%" }} />
        <Orb style={{ width: 280, height: 280, left: "2%", bottom: "-4%" }} />
        <Orb style={{ width: 60, height: 60, left: "26%", top: "20%" }} />
        {/* 우측 */}
        <Orb style={{ width: 180, height: 180, right: "8%", top: "10%" }} />
        <Orb style={{ width: 80, height: 80, right: "20%", top: "42%" }} />
        <Orb style={{ width: 55, height: 55, right: "5%", top: "55%" }} />
        <YellowOrb style={{ width: 140, right: "8%", bottom: "8%" }} />
        <Orb style={{ width: 90, height: 90, right: "26%", bottom: "12%" }} />
        {/* 상단 작은 점 */}
        <Orb style={{ width: 40, height: 40, left: "50%", top: "8%" }} />

        {/* 중앙 카드 */}
        <div style={{ position: "relative", width: "100%", maxWidth: 460, background: "rgba(255,255,255,0.78)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 32, boxShadow: "0 24px 70px rgba(60,100,200,0.18)", padding: "44px 52px", zIndex: 2, textAlign: "center", border: "1px solid rgba(255,255,255,0.6)" }}>
          {content}
        </div>
      </div>
    );
  }

  // 모바일: 풀스크린
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #EEF4FC 0%, #DCE6F5 60%, #CDDCF2 100%)", fontFamily: FONT, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px", position: "relative", overflow: "hidden" }}>
      {/* 모바일 배경 구슬 (시안 위치) */}
      <Orb style={{ width: 80, height: 80, right: 30, top: 90 }} />
      <Orb style={{ width: 25, height: 25, left: 50, top: 240 }} />
      <SaturnOrb style={{ width: 150, left: -50, top: 400 }} />
      <Orb style={{ width: 45, height: 45, right: 40, top: 460 }} />
      <Orb style={{ width: 20, height: 20, right: 90, top: 560 }} />
      <Orb style={{ width: 16, height: 16, right: 60, top: 690 }} />
      <Orb style={{ width: 65, height: 65, left: 15, bottom: 50 }} />
      <YellowOrb style={{ width: 80, right: 25, bottom: 25 }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 360, textAlign: "center", paddingTop: 50, paddingBottom: 30, zIndex: 2 }}>
        {content}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   MEMBER APP
═══════════════════════════════════════════════════ */
function MemberApp(props) {
  var _tab = useState("home"), tab = _tab[0], setTab = _tab[1];
  var tabs = [
    { key: "home", label: "홈", icon: <NavHome /> },
    { key: "cert", label: "인증", icon: <NavCheck /> },
    { key: "record", label: "내 기록", icon: <NavList /> },
    { key: "profile", label: "내 정보", icon: <NavUser /> },
  ];
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, paddingBottom: 80 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", position: "relative" }}>
        {tab === "home" && <MemberHome session={props.session} onTab={setTab} />}
        {tab === "cert" && <MemberCert session={props.session} onTab={setTab} />}
        {tab === "record" && <MemberRecord session={props.session} />}
        {tab === "profile" && <MemberProfile session={props.session} onLogout={props.onLogout} />}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E5EAF2", display: "flex", zIndex: 30, maxWidth: 480, margin: "0 auto" }}>
        {tabs.map(function(t) {
          var active = tab === t.key;
          return (
            <button key={t.key} onClick={function() { setTab(t.key); }}
              style={{ flex: 1, border: "none", background: "none", cursor: "pointer", fontFamily: FONT, padding: "12px 0 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: active ? BLUE : "#9AA3B2", position: "relative" }}>
              {t.icon}
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{t.label}</span>
              {active && <div style={{ position: "absolute", bottom: 8, width: 4, height: 4, borderRadius: "50%", background: BLUE }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MemberHome(props) {
  var session = props.session;
  var myKey = keyOf(session.member);
  var today = todayKST();
  var _mission = useState(null), mission = _mission[0], setMission = _mission[1];
  var _myProof = useState(null), myProof = _myProof[0], setMyProof = _myProof[1];
  var _records = useState([]), records = _records[0], setRecords = _records[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];

  var load = useCallback(async function() {
    setLoading(true);
    var r1 = await supabase.from("missions").select("*").eq("mission_date", today).maybeSingle();
    setMission(r1.data || null);
    var r2 = await supabase.from("proofs").select("*").eq("member_key", myKey).eq("mission_date", today).maybeSingle();
    setMyProof(r2.data || null);
    var r3 = await supabase.from("proofs").select("*").eq("member_key", myKey).order("submitted_at", { ascending: false }).limit(5);
    setRecords(r3.data || []);
    setLoading(false);
  }, [myKey, today]);

  useEffect(function() { load(); }, [load]);

  var isAssignee = mission && mission.assignees && mission.assignees.indexOf(myKey) !== -1;
  var myStatus = myProof ? myProof.status : (isAssignee ? "none" : null);

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 0 6px" }}>
        <img src={mastLogo} alt="MAST" style={{ height: 26 }} />
        <IconBell color={SUB} />
      </div>
      <div style={{ fontSize: 14, color: "#4A5568", marginBottom: 4 }}>안녕하세요,</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: INK, marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
        {session.member.name}님 <IconHand />
      </div>

      {loading ? (
        <div style={card({ marginBottom: 16, textAlign: "center", color: SUB })}>불러오는 중...</div>
      ) : !mission ? (
        <div style={card({ marginBottom: 16, textAlign: "center", padding: 32 })}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><IconInbox /></div>
          <div style={{ fontSize: 14, color: SUB, fontWeight: 600 }}>오늘 등록된 홍보 미션이 없습니다.</div>
        </div>
      ) : (
        <div style={card({ background: "linear-gradient(135deg,#3B72E8 0%,#5A8EF5 100%)", color: "#fff", marginBottom: 16, padding: 22, position: "relative", overflow: "visible" })}>
          <img src={megaphoneImg} alt="" style={{ position: "absolute", right: -16, top: -30, width: 130, height: "auto", filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.15))" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, marginBottom: 8 }}>오늘 홍보 대상자</div>
            {isAssignee ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>당신은</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>오늘 대상입니다!</div>
              </>
            ) : (
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{mission.title}</div>
            )}
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}>
              <IconClock color="#fff" />마감 {mission.deadline}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(mission.assignees || []).slice(0, 5).map(function(k) {
                var parts = k.split("|");
                var mine = k === myKey;
                return (
                  <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: mine ? "#fff" : "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: mine ? BLUE : "#fff", fontWeight: 800, fontSize: 14, border: mine ? "2px solid #fff" : "none" }}>
                      {parts[0].slice(0, 1)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{parts[0]}{mine ? " (나)" : ""}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 10 }}>총 {(mission.assignees || []).length}명</div>
          </div>
        </div>
      )}

      {mission && isAssignee && (
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <div style={card({ flex: 1, padding: 16 })}>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 6, fontWeight: 600 }}>현재 상태</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: stColor(myStatus), display: "inline-block" }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: stColor(myStatus) }}>{stLabel(myStatus)}</span>
            </div>
            <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>마감 {mission.deadline}까지</div>
          </div>
          <button onClick={function() { props.onTab("cert"); }}
            style={{ flex: 1, border: "none", borderRadius: 18, background: "linear-gradient(135deg,#3B72E8,#5A8EF5)", color: "#fff", cursor: "pointer", fontFamily: FONT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "14px" }}>
            <CameraIcon size={32} />
            <span style={{ fontSize: 14, fontWeight: 800 }}>{myProof ? "사진 수정" : "인증하기"}</span>
          </button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: INK }}>나의 최근 기록</div>
        <button onClick={function() { props.onTab("record"); }} style={{ border: "none", background: "none", color: BLUE, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>전체 보기 ›</button>
      </div>
      <div style={card({ padding: 0, overflow: "hidden" })}>
        {records.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: SUB }}>기록이 없습니다.</div>
        ) : records.map(function(r, i) {
          return (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid #F1F4F9" : "none" }}>
              <div style={{ fontSize: 13, color: "#4A5568", fontWeight: 600 }}>{fmtDate(r.mission_date)}</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: stColor(r.status), background: stBg(r.status), padding: "4px 12px", borderRadius: 999 }}>{stLabel(r.status)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MemberCert(props) {
  var session = props.session;
  var myKey = keyOf(session.member);
  var today = todayKST();
  var _mission = useState(null), mission = _mission[0], setMission = _mission[1];
  var _myProof = useState(null), myProof = _myProof[0], setMyProof = _myProof[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var _done = useState(false), done = _done[0], setDone = _done[1];

  var load = useCallback(async function() {
    setLoading(true);
    var r1 = await supabase.from("missions").select("*").eq("mission_date", today).maybeSingle();
    setMission(r1.data || null);
    var r2 = await supabase.from("proofs").select("*").eq("member_key", myKey).eq("mission_date", today).maybeSingle();
    setMyProof(r2.data || null);
    setLoading(false);
  }, [myKey, today]);

  useEffect(function() { load(); }, [load]);

  var isAssignee = mission && mission.assignees && mission.assignees.indexOf(myKey) !== -1;

  if (loading) return <CenteredMsg msg="불러오는 중..." />;

  if (done) return (
    <div style={{ padding: "0 16px" }}>
      <PageHeader title="인증 완료" />
      <div style={{ padding: "20px 0", textAlign: "center", position: "relative" }}>
        {/* 장식 파티클 */}
        <div style={{ position: "absolute", left: "15%", top: 40, width: 8, height: 8, background: "#FBBF24", borderRadius: 2, transform: "rotate(45deg)" }} />
        <div style={{ position: "absolute", right: "20%", top: 20, width: 7, height: 7, background: "#3B72E8", borderRadius: 2, transform: "rotate(45deg)" }} />
        <div style={{ position: "absolute", left: "10%", top: 180, width: 6, height: 6, background: "#E04848", borderRadius: 2, transform: "rotate(45deg)" }} />
        <div style={{ position: "absolute", right: "12%", top: 160, width: 8, height: 8, background: "#10A26A", borderRadius: 2, transform: "rotate(45deg)" }} />
        <div style={{ position: "absolute", right: "30%", top: 220, width: 5, height: 5, background: "#FBBF24", borderRadius: 2, transform: "rotate(45deg)" }} />

        <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
          <img src={successCheckImg} alt="인증 완료" style={{ width: 240, height: "auto", filter: "drop-shadow(0 16px 28px rgba(16,162,106,0.25))" }} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: INK, marginBottom: 6 }}>인증이 제출되었습니다!</div>
        <div style={{ fontSize: 14, color: SUB, marginBottom: 28 }}>관리자 승인 후 인증 완료로 표시됩니다.</div>
        <button style={btnPrimary()} onClick={function() { setDone(false); props.onTab("home"); }}>홈으로 돌아가기</button>
      </div>
    </div>
  );

  if (!mission) return (
    <div style={{ padding: "0 16px" }}>
      <PageHeader title="인증하기" />
      <CenteredMsg msg="오늘 등록된 홍보 미션이 없습니다." />
    </div>
  );

  if (!isAssignee) return (
    <div style={{ padding: "0 16px" }}>
      <PageHeader title="인증하기" />
      <div style={{ padding: "60px 24px", textAlign: "center" }}>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}><IconLockBig /></div>
        <div style={{ fontSize: 18, fontWeight: 800, color: INK, marginBottom: 8 }}>오늘 담당자가 아닙니다</div>
        <div style={{ fontSize: 14, color: SUB }}>인증은 오늘 지정된 담당자만 가능합니다.</div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "0 16px" }}>
      <PageHeader title="인증하기" />

      <div style={card({ marginBottom: 16 })}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, marginBottom: 6 }}>오늘 홍보 미션</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: INK, marginBottom: 8 }}>{mission.title}</div>
        {mission.body && (
          <div style={{ fontSize: 13, color: "#4A5568", lineHeight: 1.7, marginBottom: 10, whiteSpace: "pre-wrap" }}>
            {mission.body}
          </div>
        )}
        <div style={{ fontSize: 12, color: "#E05A00", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <IconClock color="#E05A00" />마감 {mission.deadline}
        </div>

        {mission.mission_image_url && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #F1F4F9" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: SUB, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
              <IconAttach color={SUB} />첨부 이미지 (다운로드해서 에타에 업로드)
            </div>
            <img src={mission.mission_image_url} alt="미션 첨부" style={{ width: "100%", borderRadius: 12, border: "1px solid #E5EAF2" }} />
            <a href={mission.mission_image_url} download target="_blank" rel="noreferrer"
               style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, padding: "10px 0", background: "#F0F4FB", color: BLUE, fontWeight: 700, fontSize: 13, borderRadius: 10, textDecoration: "none" }}>
              <IconDownload />이미지 다운로드
            </a>
          </div>
        )}
      </div>

      {myProof && myProof.status === ST.APPROVED ? (
        <div style={card({ background: "#E6F8EF", border: "1px solid #B8E6CD" })}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <IconCheck color="#10A26A" />
            <span style={{ fontSize: 15, fontWeight: 800, color: "#10A26A" }}>인증 완료</span>
            <span style={{ fontSize: 12, color: SUB, marginLeft: "auto" }}>{fmtTime(myProof.submitted_at)}</span>
          </div>
          <div style={{ fontSize: 13, color: "#4A5568" }}>승인되었습니다. 수고하셨습니다.</div>
        </div>
      ) : (
        <UploadForm myKey={myKey} memberName={session.member.name} today={today} missionId={mission.id}
          existingProof={myProof} onDone={function() { setDone(true); }} />
      )}

      <div style={card({ marginTop: 16, background: "rgba(255,255,255,0.7)" })}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 8 }}>인증 시 유의사항</div>
        <div style={{ fontSize: 12, color: SUB, lineHeight: 1.7 }}>
          • 에브리타임 게시글이 보이도록 캡처해주세요.<br />
          • 조작된 이미지가 확인될 경우 인정되지 않습니다.
        </div>
      </div>
    </div>
  );
}

function UploadForm(props) {
  var myKey = props.myKey, memberName = props.memberName, today = props.today, missionId = props.missionId, existingProof = props.existingProof;
  var _file = useState(null), file = _file[0], setFile = _file[1];
  var _preview = useState(null), preview = _preview[0], setPreview = _preview[1];
  var _busy = useState(false), busy = _busy[0], setBusy = _busy[1];
  var _err = useState(""), err = _err[0], setErr = _err[1];
  var fileRef = useRef(null);

  function pick(e) {
    var f = e.target.files ? e.target.files[0] : null;
    if (!f) return;
    if (!/^image\//.test(f.type)) { setErr("이미지 파일만 업로드 가능합니다."); return; }
    setErr(""); setFile(f);
    var reader = new FileReader();
    reader.onload = function() { setPreview(reader.result); };
    reader.readAsDataURL(f);
  }

  async function submit() {
    if (!file && !existingProof) { setErr("사진을 선택해 주세요."); return; }
    setBusy(true); setErr("");
    try {
      var row = { mission_id: missionId, mission_date: today, member_key: myKey, member_name: memberName, status: ST.PENDING, submitted_at: new Date().toISOString() };

      if (file) {
        if (existingProof && existingProof.proof_file_path) {
          await supabase.storage.from(PROOF_BUCKET).remove([existingProof.proof_file_path]);
        }
        var ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!ext) ext = "jpg";
        var safeKey = encodeURIComponent(myKey).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
        var path = today + "/" + safeKey + "_" + Date.now() + "." + ext;
        var upRes = await supabase.storage.from(PROOF_BUCKET).upload(path, file, { upsert: true });
        if (upRes.error) throw upRes.error;
        row.proof_image_url = supabase.storage.from(PROOF_BUCKET).getPublicUrl(path).data.publicUrl;
        row.proof_file_path = path;
      }

      var dbRes;
      if (existingProof) {
        dbRes = await supabase.from("proofs").update(row).eq("id", existingProof.id);
      } else {
        dbRes = await supabase.from("proofs").upsert(row, { onConflict: "mission_date,member_key" });
      }
      if (dbRes.error) throw dbRes.error;
      props.onDone();
    } catch(e) { setErr("업로드 중 오류가 발생했습니다. 다시 시도해 주세요."); console.error(e); }
    finally { setBusy(false); }
  }

  var existingImg = existingProof && existingProof.proof_image_url;

  return (
    <div style={card()}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#4A5568", marginBottom: 10 }}>에타 게시글 캡처 이미지를 업로드해주세요</div>
      {existingProof && (
        <div style={{ fontSize: 12, color: existingProof.status === ST.REJECTED ? "#E04848" : "#3B72E8", marginBottom: 10, fontWeight: 600 }}>
          {existingProof.status === ST.REJECTED ? "사진 반려됨. 다시 올려주세요." : "이미 제출되었습니다. 사진을 변경할 수 있습니다."}
        </div>
      )}

      {(preview || existingImg) ? (
        <div style={{ position: "relative", marginBottom: 12 }}>
          <img src={preview || existingImg} alt="미리보기" style={{ width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 14, border: "1px solid #E5EAF2" }} />
          <button onClick={function() { fileRef.current && fileRef.current.click(); }}
            style={{ position: "absolute", top: 8, right: 8, border: "none", borderRadius: 8, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, padding: "5px 12px", cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>변경</button>
        </div>
      ) : (
        <div onClick={function() { fileRef.current && fileRef.current.click(); }}
          style={{ border: "2px dashed #BCD0F0", borderRadius: 16, padding: "28px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "rgba(248,250,255,0.6)", marginBottom: 12 }}>
          <img src={cameraImg} alt="" style={{ width: 200, height: "auto", filter: "drop-shadow(0 10px 20px rgba(60,100,200,0.15))" }} />
          <div style={{ fontSize: 14, color: SUB, marginTop: 12, fontWeight: 600 }}>에타 게시글 캡처 이미지를</div>
          <div style={{ fontSize: 14, color: SUB, fontWeight: 600 }}>업로드해주세요</div>
          <div style={{ fontSize: 11, color: "#A8B2C5", marginTop: 6 }}>JPG, PNG (최대 10MB)</div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
      {err && <div style={{ fontSize: 13, color: "#C0392B", marginBottom: 10, fontWeight: 600 }}>{err}</div>}
      <button style={btnPrimary({ opacity: busy ? 0.7 : 1 })} disabled={busy} onClick={submit}>
        {busy ? "업로드 중..." : existingProof ? "사진 수정 완료" : "인증 제출"}
      </button>
    </div>
  );
}

function MemberRecord(props) {
  var myKey = keyOf(props.session.member);
  var _records = useState([]), records = _records[0], setRecords = _records[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];

  useEffect(function() {
    (async function() {
      var r = await supabase.from("proofs").select("*").eq("member_key", myKey).order("submitted_at", { ascending: false });
      setRecords(r.data || []);
      setLoading(false);
    })();
  }, [myKey]);

  var approved = records.filter(function(r) { return r.status === ST.APPROVED; }).length;

  return (
    <div style={{ padding: "0 16px" }}>
      <PageHeader title="내 기록" />
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <StatBox label="인증완료" value={approved} color={BLUE} />
        <StatBox label="전체 미션" value={records.length} color={INK} />
        <StatBox label="인증률" value={(records.length ? Math.round(approved / records.length * 100) : 0) + "%"} color="#10A26A" />
      </div>
      {loading ? <CenteredMsg msg="불러오는 중..." /> : (
        <div style={card({ padding: 0, overflow: "hidden" })}>
          {records.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 14, color: SUB }}>기록이 없습니다.</div>
          ) : records.map(function(r, i) {
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderTop: i ? "1px solid #F1F4F9" : "none" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{fmtDate(r.mission_date)}</div>
                  <div style={{ fontSize: 12, color: SUB, marginTop: 3 }}>제출 {fmtTime(r.submitted_at)}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: stColor(r.status), background: stBg(r.status), padding: "4px 12px", borderRadius: 999 }}>{stLabel(r.status)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBox(props) {
  return (
    <div style={card({ flex: 1, textAlign: "center", padding: 14 })}>
      <div style={{ fontSize: 11, color: SUB, fontWeight: 600 }}>{props.label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: props.color, marginTop: 4 }}>{props.value}</div>
    </div>
  );
}

function MemberProfile(props) {
  var m = props.session.member;
  return (
    <div style={{ padding: "0 16px" }}>
      <PageHeader title="내 정보" />
      <div style={card({ marginBottom: 16 })}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#3B72E8,#5A8EF5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 800 }}>
            {m.name.slice(0, 1)}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>{m.name}</div>
            <div style={{ fontSize: 13, color: SUB }}>{m.gi}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderTop: "1px solid #F1F4F9" }}>
          <span style={{ fontSize: 13, color: SUB }}>학교</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{m.school}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderTop: "1px solid #F1F4F9" }}>
          <span style={{ fontSize: 13, color: SUB }}>기수</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{m.gi}</span>
        </div>
      </div>
      <button style={btnGhost({ color: "#E04848" })} onClick={props.onLogout}>로그아웃</button>
    </div>
  );
}

/* ════════════════════════════════════════════════
   ADMIN APP
═══════════════════════════════════════════════════ */
function AdminApp(props) {
  var _tab = useState("dashboard"), tab = _tab[0], setTab = _tab[1];
  var navItems = [
    { key: "dashboard", label: "대시보드", icon: <NavHome /> },
    { key: "mission", label: "미션 관리", icon: <NavList /> },
    { key: "members", label: "부원 관리", icon: <NavUser /> },
    { key: "certs", label: "인증 현황", icon: <NavCheck /> },
    { key: "uncert", label: "미인증자 관리", icon: <NavWarn /> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FB", fontFamily: FONT, display: "flex" }}>
      <div style={{ width: 210, background: "#fff", borderRight: "1px solid #E5EAF2", display: "flex", flexDirection: "column", minHeight: "100vh", padding: "24px 0", flexShrink: 0 }}>
        <div style={{ padding: "0 22px 26px" }}>
          <img src={mastLogo} alt="MAST" style={{ height: 26, marginBottom: 4 }} />
          <div style={{ fontSize: 11, color: SUB, fontWeight: 600 }}>관리자 시스템</div>
        </div>
        {navItems.map(function(it) {
          var active = tab === it.key;
          return (
            <button key={it.key} onClick={function() { setTab(it.key); }}
              style={{ border: "none", background: active ? "#EEF3FB" : "none", cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 10, padding: "12px 22px", color: active ? BLUE : "#4A5568", fontWeight: active ? 800 : 600, fontSize: 14, borderLeft: active ? "3px solid " + BLUE : "3px solid transparent", textAlign: "left", width: "100%" }}>
              <span style={{ display: "flex", color: active ? BLUE : "#9AA3B2" }}>{it.icon}</span>
              {it.label}
            </button>
          );
        })}
        <div style={{ marginTop: "auto", padding: "0 22px" }}>
          <button onClick={props.onLogout} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 8, color: SUB, fontSize: 13, padding: "12px 0", fontWeight: 600 }}>
            로그아웃
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: "24px 28px", overflow: "auto", minHeight: "100vh" }}>
        {tab === "dashboard" && <AdminDashboard onTab={setTab} />}
        {tab === "mission" && <AdminMission session={props.session} />}
        {tab === "members" && <AdminMembers />}
        {tab === "certs" && <AdminCerts />}
        {tab === "uncert" && <AdminUncert />}
      </div>
    </div>
  );
}

function AdminDashboard(props) {
  var today = todayKST();
  var _mission = useState(null), mission = _mission[0], setMission = _mission[1];
  var _proofs = useState([]), proofs = _proofs[0], setProofs = _proofs[1];
  var _members = useState([]), members = _members[0], setMembers = _members[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var _cd = useState(""), cd = _cd[0], setCd = _cd[1];

  var load = useCallback(async function() {
    setLoading(true);
    var r1 = await supabase.from("missions").select("*").eq("mission_date", today).maybeSingle();
    setMission(r1.data || null);
    if (r1.data) {
      var r2 = await supabase.from("proofs").select("*").eq("mission_date", today);
      setProofs(r2.data || []);
    }
    var r3 = await supabase.from("members").select("*");
    setMembers(r3.data || []);
    setLoading(false);
  }, [today]);

  useEffect(function() { load(); }, [load]);

  useEffect(function() {
    if (!mission) return;
    function tick() {
      var now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      var parts = (mission.deadline || "23:59").split(":");
      var deadline = new Date(now);
      deadline.setHours(parseInt(parts[0]), parseInt(parts[1] || 0), 0, 0);
      var diff = deadline - now;
      if (diff <= 0) { setCd("마감"); return; }
      var h = Math.floor(diff / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      setCd(String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"));
    }
    tick();
    var timer = setInterval(tick, 1000);
    return function() { clearInterval(timer); };
  }, [mission]);

  if (loading) return <div style={{ color: SUB }}>불러오는 중...</div>;

  var assignees = mission ? (mission.assignees || []) : [];
  var assigneeMembers = assignees.map(function(k) { return members.find(function(m) { return keyOf(m) === k; }) || { name: k.split("|")[0], gi: k.split("|")[1], school: k.split("|")[2] }; });
  var approvedProofs = proofs.filter(function(p) { return p.status === ST.APPROVED; });
  var pendingProofs = proofs.filter(function(p) { return p.status === ST.PENDING; });
  var notSubmitted = assigneeMembers.filter(function(m) { return !proofs.find(function(p) { return p.member_key === keyOf(m); }); });

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: INK, marginBottom: 4 }}>관리자 대시보드</div>
      <div style={{ fontSize: 13, color: SUB, marginBottom: 22 }}>오늘의 홍보 미션 현황을 한눈에 확인하세요.</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={card({ background: "linear-gradient(135deg,#3B72E8,#5A8EF5)", color: "#fff", position: "relative", overflow: "visible" })}>
          <img src={megaphoneImg} alt="" style={{ position: "absolute", right: -10, top: -20, width: 100, height: "auto", filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.15))" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 6, fontWeight: 600 }}>오늘의 미션</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{mission ? mission.title : "미션 없음"}</div>
            {mission && <div style={{ fontSize: 12, opacity: 0.85, display: "flex", alignItems: "center", gap: 4 }}><IconClock color="#fff" />마감 {mission.deadline}</div>}
          </div>
        </div>
        <div style={card({ background: notSubmitted.length > 0 ? "#FFF5F5" : "#F0FAF5", cursor: "pointer", position: "relative", display: "flex", alignItems: "center", gap: 14 })} onClick={function() { props.onTab("uncert"); }}>
          {notSubmitted.length > 0 && <img src={sirenImg} alt="" style={{ height: 110, width: "auto", flexShrink: 0, filter: "drop-shadow(0 8px 16px rgba(224,72,72,0.25))" }} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 4, fontWeight: 600 }}>미제출자</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: notSubmitted.length > 0 ? "#E04848" : "#10A26A", marginBottom: 4 }}>{notSubmitted.length}명</div>
            <div style={{ fontSize: 12, color: SUB }}>마감까지 {cd}</div>
          </div>
        </div>
        <div style={card({ cursor: "pointer" })} onClick={function() { props.onTab("certs"); }}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4, fontWeight: 600 }}>인증 완료</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#10A26A", marginBottom: 4 }}>{approvedProofs.length}명</div>
          <div style={{ fontSize: 12, color: SUB }}>/ {assignees.length}명</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <ListPanel title={"인증 완료 (" + approvedProofs.length + "명)"} titleColor="#10A26A">
          {approvedProofs.length === 0 ? <Empty /> : approvedProofs.map(function(p) {
            return <ListRow key={p.id} name={p.member_name} sub={fmtTime(p.submitted_at) + " 인증"} badge={<IconCheck color="#10A26A" />} />;
          })}
        </ListPanel>

        <ListPanel title={"제출됨 " + pendingProofs.length + " · 미제출 " + notSubmitted.length} titleColor="#E04848">
          {pendingProofs.map(function(p) {
            return <ListRow key={p.id} name={p.member_name} sub="제출됨 (검토 대기)" badge={<IconDot color="#3B72E8" size={12} />} onClick={function() { props.onTab("certs"); }} />;
          })}
          {notSubmitted.map(function(m) {
            return <ListRow key={keyOf(m)} name={m.name} sub="미제출" badge={<IconDot color="#E04848" size={12} />} />;
          })}
          {pendingProofs.length === 0 && notSubmitted.length === 0 && <Empty />}
        </ListPanel>

        <ListPanel title={"오늘 대상자 (총 " + assignees.length + "명)"}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 14 }}>
            {assigneeMembers.map(function(m) {
              return (
                <div key={keyOf(m)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 56 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#3B72E8,#5A8EF5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13 }}>{m.name.slice(0, 1)}</div>
                  <div style={{ fontSize: 11, textAlign: "center", color: INK, fontWeight: 700 }}>{m.name}</div>
                </div>
              );
            })}
          </div>
        </ListPanel>
      </div>

      <div style={card()}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>빠른 기능</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { icon: <IconClipboard />, label: "미션 생성", tab: "mission" },
            { icon: <IconUsers />, label: "부원 관리", tab: "members" },
            { icon: <IconSiren />, label: "미인증자 보기", tab: "uncert" },
            { icon: <IconCheckCircle />, label: "인증 현황", tab: "certs" },
          ].map(function(q) {
            return (
              <button key={q.tab} onClick={function() { props.onTab(q.tab); }}
                style={{ border: "1px solid #E5EAF2", borderRadius: 14, padding: "18px 12px", background: "#F8FAFF", cursor: "pointer", fontFamily: FONT, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {q.icon}
                <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{q.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ListPanel(props) {
  return (
    <div style={card({ padding: 0, overflow: "hidden" })}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F4F9" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: props.titleColor || INK }}>{props.title}</span>
      </div>
      {props.children}
    </div>
  );
}
function ListRow(props) {
  return (
    <div onClick={props.onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderTop: "1px solid #F1F4F9", cursor: props.onClick ? "pointer" : "default" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EEF3FB", display: "flex", alignItems: "center", justifyContent: "center", color: BLUE, fontWeight: 800, fontSize: 13 }}>{props.name.slice(0, 1)}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{props.name}</div>
        <div style={{ fontSize: 11, color: SUB }}>{props.sub}</div>
      </div>
      <span style={{ fontSize: 16, display: "flex", alignItems: "center" }}>{props.badge}</span>
    </div>
  );
}
function Empty() { return <div style={{ padding: 18, fontSize: 13, color: SUB, textAlign: "center" }}>없음</div>; }

/* ─── 관리자 미션 관리 (수정·삭제 포함) ─── */
function AdminMission(props) {
  var today = todayKST();
  var _mission = useState(null), mission = _mission[0], setMission = _mission[1];
  var _members = useState([]), members = _members[0], setMembers = _members[1];
  var _title = useState(""), title = _title[0], setTitle = _title[1];
  var _body = useState(""), body = _body[0], setBody = _body[1];
  var _deadline = useState("23:59"), deadline = _deadline[0], setDeadline = _deadline[1];
  var _selected = useState(new Set()), selected = _selected[0], setSelected = _selected[1];
  var _query = useState(""), query = _query[0], setQuery = _query[1];
  var _busy = useState(false), busy = _busy[0], setBusy = _busy[1];
  var _msg = useState(""), msg = _msg[0], setMsg = _msg[1];
  var _pastMissions = useState([]), pastMissions = _pastMissions[0], setPastMissions = _pastMissions[1];
  var _imgFile = useState(null), imgFile = _imgFile[0], setImgFile = _imgFile[1];
  var _imgPreview = useState(null), imgPreview = _imgPreview[0], setImgPreview = _imgPreview[1];
  var imgRef = useRef(null);

  var load = useCallback(async function() {
    var r1 = await supabase.from("missions").select("*").eq("mission_date", today).maybeSingle();
    if (r1.data) {
      setMission(r1.data);
      setTitle(r1.data.title || ""); setBody(r1.data.body || ""); setDeadline(r1.data.deadline || "23:59");
      setSelected(new Set(r1.data.assignees || []));
      if (r1.data.mission_image_url) setImgPreview(r1.data.mission_image_url);
    } else {
      setMission(null); setTitle(""); setBody(""); setDeadline("23:59"); setSelected(new Set()); setImgPreview(null);
    }
    var r2 = await supabase.from("members").select("*");
    setMembers(r2.data || []);
    var r3 = await supabase.from("missions").select("*").lt("mission_date", today).order("mission_date", { ascending: false }).limit(10);
    setPastMissions(r3.data || []);
  }, [today]);

  useEffect(function() { load(); }, [load]);

  var filtered = query.trim() ? members.filter(function(m) { return m.name.includes(query) || m.school.includes(query) || m.gi.includes(query); }) : members;

  function pickImage(e) {
    var f = e.target.files ? e.target.files[0] : null;
    if (!f) return;
    setImgFile(f);
    var reader = new FileReader();
    reader.onload = function() { setImgPreview(reader.result); };
    reader.readAsDataURL(f);
  }

  async function save() {
    if (!title.trim() || selected.size === 0) { setMsg("미션 제목과 담당자를 입력해 주세요."); return; }
    setBusy(true); setMsg("");
    try {
      var row = { mission_date: today, title: title.trim(), body: body.trim() || null, deadline: deadline, assignees: Array.from(selected), created_by: props.session.member.name };

      if (imgFile) {
        if (mission && mission.mission_image_path) {
          await supabase.storage.from(MISSION_BUCKET).remove([mission.mission_image_path]);
        }
        var ext = (imgFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        var path = today + "_" + Date.now() + "." + ext;
        var upRes = await supabase.storage.from(MISSION_BUCKET).upload(path, imgFile, { upsert: true });
        if (upRes.error) throw upRes.error;
        row.mission_image_url = supabase.storage.from(MISSION_BUCKET).getPublicUrl(path).data.publicUrl;
        row.mission_image_path = path;
      }

      var r;
      if (mission) {
        r = await supabase.from("missions").update(row).eq("id", mission.id);
      } else {
        r = await supabase.from("missions").upsert(row, { onConflict: "mission_date" });
      }
      if (r.error) throw r.error;
      setMsg("저장되었습니다. 전 부원에게 공개됩니다.");
      setImgFile(null);
      await load();
    } catch(e) { setMsg("저장 중 오류가 발생했습니다: " + e.message); console.error(e); }
    finally { setBusy(false); }
  }

  async function removeImage() {
    if (!mission || !mission.mission_image_path) {
      setImgFile(null); setImgPreview(null); return;
    }
    if (!confirm("미션 첨부 이미지를 삭제하시겠습니까?")) return;
    await supabase.storage.from(MISSION_BUCKET).remove([mission.mission_image_path]);
    await supabase.from("missions").update({ mission_image_url: null, mission_image_path: null }).eq("id", mission.id);
    setImgFile(null); setImgPreview(null);
    await load();
  }

  async function deleteMission(m) {
    if (!confirm("미션 \"" + m.title + "\" 을(를) 완전히 삭제하시겠습니까?\n관련된 부원들의 인증 기록도 모두 삭제됩니다.")) return;
    // 1. 미션 이미지 삭제
    if (m.mission_image_path) {
      await supabase.storage.from(MISSION_BUCKET).remove([m.mission_image_path]);
    }
    // 2. 인증 사진들 삭제
    var proofs = await supabase.from("proofs").select("proof_file_path").eq("mission_id", m.id);
    var paths = (proofs.data || []).map(function(p) { return p.proof_file_path; }).filter(Boolean);
    if (paths.length) await supabase.storage.from(PROOF_BUCKET).remove(paths);
    // 3. proofs는 cascade로 자동 삭제됨. 미션 삭제.
    await supabase.from("missions").delete().eq("id", m.id);
    await load();
  }

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: INK, marginBottom: 20 }}>미션 관리</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={card()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{mission ? "오늘 미션 수정" : "오늘 미션 등록"}</div>
            {mission && (
              <button onClick={function() { deleteMission(mission); }} style={btnSmall({ background: "#FDECEC", color: "#E04848" })}>오늘 미션 삭제</button>
            )}
          </div>
          <AField label="미션 제목">
            <input style={aInput()} value={title} placeholder="예: 2026-2학기 신입부원 모집 홍보" onChange={function(e) { setTitle(e.target.value); }} />
          </AField>
          <AField label="미션 내용 (선택, 줄바꿈 유지됨)">
            <textarea style={Object.assign({}, aInput(), { height: 100, resize: "vertical" })} value={body} placeholder={"상세 내용\n예시:\n1. 학과 게시판에 게시\n2. 신청 링크 포함"} onChange={function(e) { setBody(e.target.value); }} />
          </AField>
          <AField label="마감 시각">
            <input style={Object.assign({}, aInput(), { width: 140 })} type="time" value={deadline} onChange={function(e) { setDeadline(e.target.value); }} />
          </AField>

          <AField label="첨부 이미지 (선택) — 부원이 다운로드해서 에타에 업로드">
            {imgPreview ? (
              <div>
                <img src={imgPreview} alt="미리보기" style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 10, border: "1px solid #E5EAF2" }} />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={function() { imgRef.current && imgRef.current.click(); }} style={btnSmall({ background: "#F0F4FB", color: BLUE })}>변경</button>
                  <button onClick={removeImage} style={btnSmall({ background: "#FDECEC", color: "#E04848" })}>삭제</button>
                </div>
              </div>
            ) : (
              <div onClick={function() { imgRef.current && imgRef.current.click(); }}
                style={{ border: "2px dashed #BCD0F0", borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer", background: "#F8FAFF" }}>
                <div style={{ marginBottom: 6, display: "flex", justifyContent: "center" }}><IconAttach color={SUB} /></div>
                <div style={{ fontSize: 13, color: SUB }}>이미지 첨부</div>
              </div>
            )}
            <input ref={imgRef} type="file" accept="image/*" onChange={pickImage} style={{ display: "none" }} />
          </AField>

          <AField label={"담당자 지정 (" + selected.size + "명)"}>
            <input style={aInput()} value={query} placeholder="이름/학교/기수 검색" onChange={function(e) { setQuery(e.target.value); }} />
          </AField>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button style={btnSmall({ background: "#F8FAFF", border: "1px solid #DDE4F0" })} onClick={function() { setSelected(new Set(members.map(keyOf))); }}>전체 선택</button>
            <button style={btnSmall({ background: "#F8FAFF", border: "1px solid #DDE4F0" })} onClick={function() { setSelected(new Set()); }}>전체 해제</button>
          </div>
          <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid #E5EAF2", borderRadius: 10, marginBottom: 14, background: "#fff" }}>
            {filtered.map(function(m) {
              var k = keyOf(m), on = selected.has(k);
              return (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: "1px solid #F1F4F9", cursor: "pointer", background: on ? "#EEF3FB" : "#fff" }}>
                  <input type="checkbox" checked={on} onChange={function() { setSelected(function(prev) { var n = new Set(prev); if(n.has(k)) n.delete(k); else n.add(k); return n; }); }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{m.name}</span>
                  <span style={{ fontSize: 12, color: SUB }}>{m.gi + " · " + m.school}</span>
                </label>
              );
            })}
          </div>
          {msg && <div style={{ fontSize: 13, color: msg.indexOf("오류") !== -1 ? "#E04848" : "#10A26A", marginBottom: 10, fontWeight: 600 }}>{msg}</div>}
          <button style={btnPrimary({ opacity: busy ? 0.7 : 1, padding: "12px 0", fontSize: 14 })} disabled={busy} onClick={save}>
            {busy ? "저장 중..." : mission ? "미션 수정 저장" : "미션 등록 (전 부원 공개)"}
          </button>
        </div>

        <div style={card({ padding: 0, overflow: "hidden", alignSelf: "start" })}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F4F9", fontSize: 16, fontWeight: 800 }}>과거 미션 기록</div>
          {pastMissions.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: SUB }}>과거 미션이 없습니다.</div>
          ) : pastMissions.map(function(m, i) {
            return (
              <div key={m.id} style={{ padding: "13px 20px", borderTop: i ? "1px solid #F1F4F9" : "none", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: SUB, marginTop: 3 }}>{m.mission_date + " · " + (m.assignees || []).length + "명 담당"}</div>
                </div>
                <button onClick={function() { deleteMission(m); }} style={btnSmall({ background: "#FDECEC", color: "#E04848" })}>삭제</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── 관리자 부원 관리 (추가·수정·삭제, 상세 모달) ─── */
function AdminMembers() {
  var _members = useState([]), members = _members[0], setMembers = _members[1];
  var _proofStats = useState({}), proofStats = _proofStats[0], setProofStats = _proofStats[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var _query = useState(""), query = _query[0], setQuery = _query[1];
  var _detail = useState(null), detail = _detail[0], setDetail = _detail[1];
  var _editing = useState(null), editing = _editing[0], setEditing = _editing[1];
  var _showAdd = useState(false), showAdd = _showAdd[0], setShowAdd = _showAdd[1];

  var load = useCallback(async function() {
    setLoading(true);
    var r1 = await supabase.from("members").select("*").order("name");
    setMembers(r1.data || []);
    var r2 = await supabase.from("proofs").select("member_key, status");
    var stats = {};
    (r2.data || []).forEach(function(p) {
      if (!stats[p.member_key]) stats[p.member_key] = { total: 0, approved: 0, rejected: 0, pending: 0 };
      stats[p.member_key].total++;
      if (p.status === ST.APPROVED) stats[p.member_key].approved++;
      else if (p.status === ST.REJECTED) stats[p.member_key].rejected++;
      else if (p.status === ST.PENDING) stats[p.member_key].pending++;
    });
    setProofStats(stats);
    setLoading(false);
  }, []);

  useEffect(function() { load(); }, [load]);

  async function deleteMember(m) {
    if (!confirm("부원 \"" + m.name + "\" 을(를) 명단에서 삭제하시겠습니까?\n인증 기록도 함께 삭제됩니다.")) return;
    var k = keyOf(m);
    // 인증 사진들 삭제
    var proofs = await supabase.from("proofs").select("proof_file_path").eq("member_key", k);
    var paths = (proofs.data || []).map(function(p) { return p.proof_file_path; }).filter(Boolean);
    if (paths.length) await supabase.storage.from(PROOF_BUCKET).remove(paths);
    await supabase.from("proofs").delete().eq("member_key", k);
    await supabase.from("members").delete().eq("name", m.name).eq("gi", m.gi).eq("school", m.school);
    await load();
  }

  var filtered = query.trim() ? members.filter(function(m) { return m.name.includes(query) || m.school.includes(query) || m.gi.includes(query); }) : members;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: INK }}>부원 관리</div>
        <button onClick={function() { setShowAdd(true); }} style={btnPrimary({ width: "auto", padding: "10px 18px", fontSize: 14 })}>+ 부원 추가</button>
      </div>
      <div style={{ marginBottom: 14 }}>
        <input style={Object.assign({}, aInput(), { maxWidth: 320 })} value={query} placeholder="이름/학교/기수 검색" onChange={function(e) { setQuery(e.target.value); }} />
      </div>
      <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>부원을 클릭하면 상세 인증 이력을 볼 수 있습니다.</div>
      {loading ? <div style={{ color: SUB }}>불러오는 중...</div> : (
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr 0.8fr 0.8fr 1.2fr 1fr", padding: "13px 20px", borderBottom: "1px solid #F1F4F9", background: "#F8FAFF" }}>
            {["이름", "학교", "기수", "총 수행", "인증률", "관리"].map(function(h) {
              return <div key={h} style={{ fontSize: 12, fontWeight: 800, color: SUB }}>{h}</div>;
            })}
          </div>
          {filtered.map(function(m, i) {
            var k = keyOf(m);
            var st = proofStats[k] || { total: 0, approved: 0 };
            var rate = st.total > 0 ? Math.round(st.approved / st.total * 100) : 0;
            return (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr 0.8fr 0.8fr 1.2fr 1fr", padding: "13px 20px", borderTop: i ? "1px solid #F1F4F9" : "none", alignItems: "center" }}>
                <div onClick={function() { setDetail(m); }} style={{ fontWeight: 700, fontSize: 14, color: BLUE, cursor: "pointer" }}>{m.name} ›</div>
                <div style={{ fontSize: 13, color: "#4A5568" }}>{m.school}</div>
                <div style={{ fontSize: 13, color: SUB }}>{m.gi}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: BLUE }}>{st.approved}회</div>
                <div>
                  <div style={{ height: 6, background: "#F1F4F9", borderRadius: 999, width: 90 }}>
                    <div style={{ height: 6, background: rate >= 80 ? "#10A26A" : rate >= 50 ? BLUE : "#E05A00", borderRadius: 999, width: rate + "%" }} />
                  </div>
                  <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{rate}%</div>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button onClick={function() { setEditing(m); }} style={btnSmall({ background: "#F0F4FB", color: BLUE, padding: "5px 10px" })}>수정</button>
                  <button onClick={function() { deleteMember(m); }} style={btnSmall({ background: "#FDECEC", color: "#E04848", padding: "5px 10px" })}>삭제</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && <MemberDetailModal member={detail} onClose={function() { setDetail(null); }} onChanged={load} />}
      {(showAdd || editing) && <MemberFormModal member={editing} onClose={function() { setShowAdd(false); setEditing(null); }} onSaved={function() { setShowAdd(false); setEditing(null); load(); }} />}
    </div>
  );
}

function MemberFormModal(props) {
  var isEdit = !!props.member;
  var _n = useState(isEdit ? props.member.name : ""), name = _n[0], setName = _n[1];
  var _g = useState(isEdit ? props.member.gi : ""), gi = _g[0], setGi = _g[1];
  var _sc = useState(isEdit ? props.member.school : ""), school = _sc[0], setSchool = _sc[1];
  var _busy = useState(false), busy = _busy[0], setBusy = _busy[1];
  var _err = useState(""), err = _err[0], setErr = _err[1];

  async function save() {
    if (!name.trim() || !gi.trim() || !school.trim()) { setErr("모든 항목을 입력해 주세요."); return; }
    setBusy(true); setErr("");
    try {
      if (isEdit) {
        var r = await supabase.from("members").update({ name: name.trim(), gi: gi.trim(), school: school.trim() })
          .eq("name", props.member.name).eq("gi", props.member.gi).eq("school", props.member.school);
        if (r.error) throw r.error;
      } else {
        var r2 = await supabase.from("members").insert({ name: name.trim(), gi: gi.trim(), school: school.trim() });
        if (r2.error) throw r2.error;
      }
      props.onSaved();
    } catch(e) { setErr("저장 실패: " + e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal onClose={props.onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{isEdit ? "부원 수정" : "부원 추가"}</div>
      <AField label="이름"><input style={aInput()} value={name} onChange={function(e) { setName(e.target.value); }} placeholder="홍길동" /></AField>
      <AField label="기수"><input style={aInput()} value={gi} onChange={function(e) { setGi(e.target.value); }} placeholder="26기" /></AField>
      <AField label="학교"><input style={aInput()} value={school} onChange={function(e) { setSchool(e.target.value); }} placeholder="홍익대학교" /></AField>
      {err && <div style={{ fontSize: 13, color: "#E04848", marginBottom: 10 }}>{err}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button style={btnGhost()} onClick={props.onClose}>취소</button>
        <button style={btnPrimary({ opacity: busy ? 0.6 : 1 })} disabled={busy} onClick={save}>{busy ? "저장 중..." : "저장"}</button>
      </div>
    </Modal>
  );
}

function MemberDetailModal(props) {
  var member = props.member;
  var myKey = keyOf(member);
  var _data = useState(null), data = _data[0], setData = _data[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];

  var load = useCallback(async function() {
    setLoading(true);
    var r1 = await supabase.from("missions").select("*").order("mission_date", { ascending: false });
    var r2 = await supabase.from("proofs").select("*").eq("member_key", myKey);

    var allMissions = r1.data || [];
    var myProofs = r2.data || [];
    var proofMap = {};
    myProofs.forEach(function(p) { proofMap[p.mission_date] = p; });

    var myMissions = allMissions.filter(function(m) { return (m.assignees || []).indexOf(myKey) !== -1; });

    var rows = myMissions.map(function(m) {
      var p = proofMap[m.mission_date];
      return {
        mission_date: m.mission_date, title: m.title,
        status: p ? p.status : "none",
        submitted_at: p ? p.submitted_at : null,
        proof_id: p ? p.id : null,
        proof_file_path: p ? p.proof_file_path : null,
      };
    });

    var stats = {
      total: rows.length,
      approved: rows.filter(function(r) { return r.status === ST.APPROVED; }).length,
      pending: rows.filter(function(r) { return r.status === ST.PENDING; }).length,
      rejected: rows.filter(function(r) { return r.status === ST.REJECTED; }).length,
    };
    setData({ rows: rows, stats: stats });
    setLoading(false);
  }, [myKey]);

  useEffect(function() { load(); }, [load]);

  async function deleteRecord(row) {
    if (!confirm(row.mission_date + " 기록을 삭제하시겠습니까?")) return;
    if (row.proof_file_path) await supabase.storage.from(PROOF_BUCKET).remove([row.proof_file_path]);
    if (row.proof_id) await supabase.from("proofs").delete().eq("id", row.proof_id);
    await load();
    if (props.onChanged) props.onChanged();
  }

  var rate = data && data.stats.total > 0 ? Math.round(data.stats.approved / data.stats.total * 100) : 0;

  return (
    <Modal onClose={props.onClose} maxWidth={760}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#3B72E8,#5A8EF5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 900 }}>{member.name.slice(0, 1)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK }}>{member.name}</div>
          <div style={{ fontSize: 13, color: SUB }}>{member.gi + " · " + member.school}</div>
        </div>
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 30, color: SUB }}>불러오는 중...</div> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
            <StatMini label="총 담당" value={data.stats.total} color={INK} />
            <StatMini label="인증완료" value={data.stats.approved} color="#10A26A" />
            <StatMini label="제출됨" value={data.stats.pending} color={BLUE} />
            <StatMini label="사진반려" value={data.stats.rejected} color="#E04848" />
            <StatMini label="인증률" value={rate + "%"} color={rate >= 80 ? "#10A26A" : rate >= 50 ? BLUE : "#E05A00"} />
          </div>

          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>전체 인증 이력</div>
          {data.rows.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", fontSize: 13, color: SUB, background: "#F8FAFF", borderRadius: 12 }}>담당했던 미션이 없습니다.</div>
          ) : (
            <div style={{ border: "1px solid #F1F4F9", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.6fr 0.8fr 1.4fr 0.7fr 0.6fr", padding: "10px 14px", background: "#F8FAFF", fontSize: 12, fontWeight: 800, color: SUB }}>
                <div>날짜</div><div>미션</div><div>상태</div><div>특이사항</div><div>제출</div><div>관리</div>
              </div>
              {data.rows.map(function(r) {
                return (
                  <div key={r.mission_date} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.6fr 0.8fr 1.4fr 0.7fr 0.6fr", padding: "12px 14px", borderTop: "1px solid #F1F4F9", alignItems: "center", background: r.status === ST.REJECTED ? "#FFF8F8" : "#fff" }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{r.mission_date}</div>
                    <div style={{ fontSize: 12, color: "#4A5568" }}>{r.title}</div>
                    <div><span style={{ fontSize: 11, fontWeight: 700, color: stColor(r.status), background: stBg(r.status), padding: "3px 10px", borderRadius: 999 }}>{stLabel(r.status)}</span></div>
                    <div style={{ fontSize: 11, color: r.status === ST.REJECTED ? "#E04848" : SUB, fontWeight: r.status === ST.REJECTED ? 700 : 500 }}>{stNote(r.status)}</div>
                    <div style={{ fontSize: 11, color: SUB }}>{r.submitted_at ? fmtTime(r.submitted_at) : "-"}</div>
                    <div>
                      {r.proof_id && <button onClick={function() { deleteRecord(r); }} style={btnSmall({ background: "#FDECEC", color: "#E04848", padding: "4px 8px", fontSize: 11 })}>삭제</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function StatMini(props) {
  return (
    <div style={{ textAlign: "center", padding: 10, background: "#F8FAFF", borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: SUB, fontWeight: 600 }}>{props.label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: props.color, marginTop: 2 }}>{props.value}</div>
    </div>
  );
}

/* ─── 관리자 인증 현황 (개별 삭제 포함) ─── */
function AdminCerts() {
  var today = todayKST();
  var _selDate = useState(today), selDate = _selDate[0], setSelDate = _selDate[1];
  var _proofs = useState([]), proofs = _proofs[0], setProofs = _proofs[1];
  var _mission = useState(null), mission = _mission[0], setMission = _mission[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var _zoom = useState(null), zoom = _zoom[0], setZoom = _zoom[1];

  var load = useCallback(async function(date) {
    setLoading(true);
    var r1 = await supabase.from("missions").select("*").eq("mission_date", date).maybeSingle();
    setMission(r1.data || null);
    if (r1.data) {
      var r2 = await supabase.from("proofs").select("*").eq("mission_date", date);
      setProofs(r2.data || []);
    } else { setProofs([]); }
    setLoading(false);
  }, []);

  useEffect(function() { load(selDate); }, [load, selDate]);

  async function decide(proof, status) {
    if (status === ST.APPROVED && proof.proof_file_path) {
      await supabase.storage.from(PROOF_BUCKET).remove([proof.proof_file_path]);
      await supabase.from("proofs").update({ status: status, proof_image_url: null, proof_file_path: null }).eq("id", proof.id);
    } else {
      await supabase.from("proofs").update({ status: status }).eq("id", proof.id);
    }
    await load(selDate);
  }

  async function deleteProof(proof) {
    if (!confirm(proof.member_name + "의 인증 기록을 삭제하시겠습니까?")) return;
    if (proof.proof_file_path) await supabase.storage.from(PROOF_BUCKET).remove([proof.proof_file_path]);
    await supabase.from("proofs").delete().eq("id", proof.id);
    await load(selDate);
  }

  var approved = proofs.filter(function(p) { return p.status === ST.APPROVED; }).length;
  var pending = proofs.filter(function(p) { return p.status === ST.PENDING; }).length;

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: INK, marginBottom: 16 }}>인증 현황</div>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", marginBottom: 18 }}>
        <AField label="날짜 선택">
          <input style={Object.assign({}, aInput(), { width: 180 })} type="date" value={selDate} onChange={function(e) { setSelDate(e.target.value); }} />
        </AField>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#10A26A", background: "#E6F8EF", padding: "5px 14px", borderRadius: 999 }}>완료 {approved}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: BLUE, background: "#E8F0FE", padding: "5px 14px", borderRadius: 999 }}>대기 {pending}</span>
        </div>
      </div>

      {loading ? <div style={{ color: SUB }}>불러오는 중...</div> :
       !mission ? <div style={{ color: SUB }}>해당 날짜의 미션이 없습니다.</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(mission.assignees || []).map(function(k) {
            var proof = proofs.find(function(p) { return p.member_key === k; });
            var parts = k.split("|");
            var status = proof ? proof.status : "none";
            return (
              <div key={k} style={card({ display: "flex", alignItems: "center", gap: 14, padding: 16 })}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#3B72E8,#5A8EF5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, flexShrink: 0 }}>{parts[0].slice(0, 1)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{parts[0]}</div>
                  <div style={{ fontSize: 12, color: SUB }}>{parts[1] + " · " + parts[2]}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: stColor(status), background: stBg(status), padding: "5px 14px", borderRadius: 999 }}>{stLabel(status)}</span>
                {proof && proof.proof_image_url && (
                  <button onClick={function() { setZoom(proof); }} style={btnSmall({ background: "#F0F4FB", color: BLUE })}>캡처 보기</button>
                )}
                {proof && proof.status === ST.PENDING && (
                  <>
                    <button onClick={function() { decide(proof, ST.APPROVED); }} style={btnSmall({ background: "#10A26A", color: "#fff" })}>승인</button>
                    <button onClick={function() { decide(proof, ST.REJECTED); }} style={btnSmall({ background: "#E04848", color: "#fff" })}>반려</button>
                  </>
                )}
                {proof && (
                  <button onClick={function() { deleteProof(proof); }} style={btnSmall({ background: "#FDECEC", color: "#E04848" })}>삭제</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {zoom && (
        <Modal onClose={function() { setZoom(null); }} maxWidth={560}>
          <img src={zoom.proof_image_url} alt="인증 캡처" style={{ width: "100%", borderRadius: 12, maxHeight: 500, objectFit: "contain" }} />
          <div style={{ marginTop: 12, fontSize: 13, color: SUB }}>제출: {fmtTime(zoom.submitted_at)} · {zoom.member_name}</div>
        </Modal>
      )}
    </div>
  );
}

function AdminUncert() {
  var today = todayKST();
  var _mission = useState(null), mission = _mission[0], setMission = _mission[1];
  var _proofs = useState([]), proofs = _proofs[0], setProofs = _proofs[1];
  var _members = useState([]), members = _members[0], setMembers = _members[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];

  useEffect(function() {
    (async function() {
      setLoading(true);
      var r1 = await supabase.from("missions").select("*").eq("mission_date", today).maybeSingle();
      setMission(r1.data || null);
      var r2 = await supabase.from("members").select("*");
      setMembers(r2.data || []);
      if (r1.data) {
        var r3 = await supabase.from("proofs").select("*").eq("mission_date", today);
        setProofs(r3.data || []);
      }
      setLoading(false);
    })();
  }, [today]);

  if (loading) return <div style={{ color: SUB }}>불러오는 중...</div>;
  if (!mission) return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: INK, marginBottom: 8 }}>미인증자 관리</div>
      <div style={{ color: SUB, fontSize: 14 }}>오늘 등록된 미션이 없습니다.</div>
    </div>
  );

  var assignees = (mission.assignees || []).map(function(k) { return members.find(function(m) { return keyOf(m) === k; }) || { name: k.split("|")[0], gi: k.split("|")[1], school: k.split("|")[2] }; });
  var uncertified = assignees.filter(function(m) {
    var p = proofs.find(function(p) { return p.member_key === keyOf(m); });
    return !p || p.status !== ST.APPROVED;
  });

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: INK, marginBottom: 8 }}>미인증자 관리</div>
      <div style={{ fontSize: 13, color: SUB, marginBottom: 20 }}>오늘 미션: {mission.title} · 미인증 {uncertified.length}명</div>

      {uncertified.length === 0 ? (
        <div style={card({ textAlign: "center", padding: 30 })}>
          <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}><IconParty /></div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#10A26A" }}>모든 담당자가 인증을 완료했습니다!</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {uncertified.map(function(m) {
            var p = proofs.find(function(p) { return p.member_key === keyOf(m); });
            var status = p ? p.status : "none";
            return (
              <div key={keyOf(m)} style={card({ display: "flex", alignItems: "center", gap: 14, padding: 16, background: status === "none" || status === ST.REJECTED ? "#FFF5F5" : "#FFF" })}>
                <IconDot color={status === ST.PENDING ? "#3B72E8" : "#E04848"} size={16} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: SUB }}>{m.gi + " · " + m.school}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: stColor(status), background: stBg(status), padding: "5px 14px", borderRadius: 999 }}>{stLabel(status)}</span>
                {status === ST.REJECTED && (
                  <span style={{ fontSize: 11, color: "#E04848", fontWeight: 600 }}>사진 반려됨</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   공통 UI
═══════════════════════════════════════════════════ */
function Modal(props) {
  return (
    <div onClick={props.onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: "#fff", borderRadius: 22, padding: 24, maxWidth: props.maxWidth || 520, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {props.children}
        <div style={{ marginTop: 18, textAlign: "right" }}>
          <button style={btnGhost({ width: "auto", padding: "10px 24px" })} onClick={props.onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
function PageHeader(props) {
  return <div style={{ display: "flex", alignItems: "center", padding: "22px 0 18px" }}><div style={{ fontSize: 20, fontWeight: 800, color: INK }}>{props.title}</div></div>;
}
function CenteredMsg(props) { return <div style={{ padding: "60px 24px", textAlign: "center", fontSize: 15, color: SUB }}>{props.msg}</div>; }
function AField(props) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: SUB, marginBottom: 6 }}>{props.label}</div>
      {props.children}
    </div>
  );
}
function Planet(props) { return <div style={Object.assign({ position: "absolute", borderRadius: "50%", boxShadow: "inset -8px -8px 16px rgba(0,0,0,0.08), 0 4px 12px rgba(60,100,200,0.1)", pointerEvents: "none" }, props.style)} />; }
function Orb(props) {
  return (
    <div style={Object.assign({
      position: "absolute",
      borderRadius: "50%",
      background: "radial-gradient(circle at 32% 28%, #FFFFFF 0%, #B8D0F4 35%, #6FA3F0 100%)",
      boxShadow: "inset -3px -5px 10px rgba(60,100,200,0.25), 0 8px 20px rgba(60,100,200,0.18)",
      pointerEvents: "none"
    }, props.style)} />
  );
}
function YellowOrb(props) {
  return (
    <div style={Object.assign({ position: "absolute", pointerEvents: "none", width: props.style.width }, props.style)}>
      <div style={{
        width: "100%", paddingBottom: "100%", borderRadius: "50%",
        background: "radial-gradient(circle at 30% 28%, #FFFFFF 0%, #FDE8B2 30%, #F4B860 100%)",
        boxShadow: "inset -3px -5px 10px rgba(180,120,30,0.2), 0 8px 20px rgba(244,184,96,0.25)"
      }} />
    </div>
  );
}
function SaturnOrb(props) {
  var w = props.style.width || 130;
  return (
    <div style={Object.assign({ position: "absolute", pointerEvents: "none", width: w }, props.style)}>
      <svg viewBox="0 0 140 100" width={w} height={w * 100 / 140}>
        <defs>
          <radialGradient id="satplanet" cx="0.32" cy="0.28">
            <stop offset="0%" stopColor="#FFFFFF"/>
            <stop offset="35%" stopColor="#FDE8B2"/>
            <stop offset="100%" stopColor="#F4B860"/>
          </radialGradient>
          <linearGradient id="satring" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E8D4A3" stopOpacity="0.4"/>
            <stop offset="50%" stopColor="#FBF1DC" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#E8D4A3" stopOpacity="0.4"/>
          </linearGradient>
        </defs>
        {/* 뒤쪽 고리 */}
        <path d="M 12 52 Q 70 22 128 52" fill="none" stroke="url(#satring)" strokeWidth="6" />
        {/* 행성 본체 */}
        <circle cx="70" cy="50" r="38" fill="url(#satplanet)" />
        {/* 앞쪽 고리 */}
        <path d="M 12 52 Q 70 82 128 52" fill="none" stroke="url(#satring)" strokeWidth="6" />
      </svg>
    </div>
  );
}
function SaturnRing(props) {
  return (
    <div style={Object.assign({ position: "absolute", pointerEvents: "none" }, props.style)}>
      <svg width="120" height="80" viewBox="0 0 120 80">
        <defs>
          <radialGradient id="sat" cx="0.4" cy="0.4">
            <stop offset="0%" stopColor="#FDE8B2" />
            <stop offset="100%" stopColor="#F4B860" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="40" rx="50" ry="14" fill="none" stroke="#E8D4A3" strokeWidth="3" opacity="0.6" />
        <circle cx="60" cy="40" r="28" fill="url(#sat)" />
      </svg>
    </div>
  );
}
function IconInput(props) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#9AA3B2", display: "flex" }}>{props.icon}</span>
      <input style={Object.assign({}, inputSt(), props.right ? { paddingRight: 50 } : {})}
        type={props.type || "text"} value={props.value} placeholder={props.placeholder}
        onChange={function(e) { props.onChange(e.target.value); }}
        onKeyDown={function(e) { if (e.key === "Enter" && props.onEnter) props.onEnter(); }} />
      {props.right && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>{props.right}</span>}
    </div>
  );
}

function card(extra) { return Object.assign({ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderRadius: 24, padding: 20, boxShadow: "0 8px 32px rgba(100,120,255,0.08)" }, extra); }
function inputSt() { return { width: "100%", boxSizing: "border-box", border: "none", borderRadius: 22, padding: "18px 20px 18px 38px", fontSize: 15, fontFamily: FONT, color: INK, background: "rgba(255,255,255,0.92)", outline: "none", boxShadow: "0 4px 14px rgba(60,100,200,0.08)" }; }
function aInput() { return { width: "100%", boxSizing: "border-box", border: "1px solid #DDE4F0", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontFamily: FONT, color: INK, background: "#fff", outline: "none" }; }
function btnPrimary(extra) { return Object.assign({ border: "none", borderRadius: 14, padding: "15px 0", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: FONT, width: "100%", background: "linear-gradient(135deg,#5C8AE8,#3B72E8)", color: "#fff", boxShadow: "0 8px 22px rgba(59,114,232,0.35)" }, extra); }
function btnGhost(extra) { return Object.assign({ border: "1px solid #E5EAF2", borderRadius: 14, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT, width: "100%", background: "#F8FAFF", color: SUB }, extra); }
function btnSmall(extra) { return Object.assign({ border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }, extra); }

/* ════════════════════════════════════════════════
   SVG ICONS (입체감 있는 3D 풍 + 평면 라인)
═══════════════════════════════════════════════════ */
function IconUser() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function IconCap() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>; }
function IconSchool() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 21h18M5 21V7l8-4 8 4v14M9 9h1m4 0h1M9 13h1m4 0h1M9 17h6"/></svg>; }
function IconLock() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>; }
function IconEye() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }
function IconEyeOff() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>; }
function IconHelp() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A96AB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/></svg>; }
function IconHand() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="#FBBF24" stroke="none"><path d="M12 2c-1.1 0-2 .9-2 2v7H8V6c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 3.3 2.7 6 6 6h2c3.3 0 6-2.7 6-6V8c0-1.1-.9-2-2-2s-2 .9-2 2v3h-2V4c0-1.1-.9-2-2-2z"/></svg>; }
function IconBell(props) { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={props.color || "#1A2340"} strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>; }
function IconClock(props) { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={props.color || "currentColor"} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconCheck(props) { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={props.color || "#10A26A"} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function IconDot(props) { return <span style={{ display: "inline-block", width: props.size || 10, height: props.size || 10, borderRadius: "50%", background: props.color }} />; }
function IconAttach(props) { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={props.color || "currentColor"} strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>; }
function IconDownload() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>; }
function IconInbox() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <defs>
        <linearGradient id="ibg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#C5D8FB"/><stop offset="100%" stopColor="#6FA3F0"/></linearGradient>
      </defs>
      <rect x="6" y="14" width="44" height="32" rx="6" fill="url(#ibg)"/>
      <path d="M6 28h12l4 5h12l4-5h12" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconLockBig() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <defs>
        <linearGradient id="lbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#C5D8FB"/><stop offset="100%" stopColor="#6FA3F0"/></linearGradient>
      </defs>
      <rect x="10" y="24" width="36" height="26" rx="5" fill="url(#lbg)"/>
      <path d="M16 24v-6a12 12 0 0124 0v6" stroke="#6FA3F0" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <circle cx="28" cy="37" r="4" fill="#fff"/>
    </svg>
  );
}
function IconParty() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3DC489"/><stop offset="100%" stopColor="#10A26A"/></linearGradient>
      </defs>
      <circle cx="28" cy="28" r="22" fill="url(#pg)"/>
      <polyline points="18 28 25 35 38 21" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="48" cy="10" r="2" fill="#FBBF24"/>
      <circle cx="8" cy="14" r="2" fill="#3B72E8"/>
      <circle cx="50" cy="46" r="2" fill="#E04848"/>
    </svg>
  );
}
function CheckMarkBig() {
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <defs>
        <linearGradient id="cmg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3DC489"/><stop offset="100%" stopColor="#10A26A"/></linearGradient>
      </defs>
      <circle cx="55" cy="55" r="44" fill="url(#cmg)"/>
      <polyline points="37 55 50 68 75 42" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="90" y="20" width="6" height="6" fill="#FBBF24" transform="rotate(45 93 23)"/>
      <rect x="12" y="30" width="5" height="5" fill="#3B72E8" transform="rotate(45 14.5 32.5)"/>
      <rect x="95" y="80" width="5" height="5" fill="#E04848" transform="rotate(45 97.5 82.5)"/>
      <rect x="8" y="78" width="6" height="6" fill="#3DC489" transform="rotate(45 11 81)"/>
    </svg>
  );
}
function CameraIcon(props) {
  var s = props && props.size || 32;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64">
      <defs>
        <linearGradient id="camg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#A8C4F8"/><stop offset="100%" stopColor="#3B72E8"/></linearGradient>
        <radialGradient id="camLens" cx="0.4" cy="0.4"><stop offset="0%" stopColor="#fff"/><stop offset="100%" stopColor="#3B72E8"/></radialGradient>
      </defs>
      <rect x="6" y="20" width="52" height="36" rx="6" fill="url(#camg)"/>
      <rect x="22" y="14" width="20" height="10" rx="2" fill="#5A8EF5"/>
      <circle cx="32" cy="38" r="11" fill="url(#camLens)"/>
      <circle cx="32" cy="38" r="6" fill="#1A2340" opacity="0.7"/>
    </svg>
  );
}
function MegaphoneBig() {
  return (
    <svg width="240" height="180" viewBox="0 0 240 180">
      <defs>
        <linearGradient id="mgBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7BA5F2"/>
          <stop offset="100%" stopColor="#3B72E8"/>
        </linearGradient>
        <linearGradient id="mgBell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF"/>
          <stop offset="100%" stopColor="#C5D8FB"/>
        </linearGradient>
        <linearGradient id="mgHandle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5A8EF5"/>
          <stop offset="100%" stopColor="#3B72E8"/>
        </linearGradient>
        <linearGradient id="mgYellow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD97A"/>
          <stop offset="100%" stopColor="#F4B860"/>
        </linearGradient>
      </defs>
      {/* 그림자 */}
      <ellipse cx="130" cy="170" rx="80" ry="6" fill="#1A2340" opacity="0.08"/>
      {/* 본체 (왼쪽 좁고 오른쪽 넓어지는 메가폰) */}
      <path d="M75 75 Q70 75 70 80 L70 110 Q70 115 75 115 L120 110 L120 80 Z" fill="url(#mgBody)"/>
      {/* 메가폰 입구 (큰 종) */}
      <ellipse cx="160" cy="95" rx="55" ry="50" fill="url(#mgBell)"/>
      <ellipse cx="160" cy="95" rx="55" ry="50" fill="none" stroke="#3B72E8" strokeWidth="3"/>
      {/* 메가폰 입구 안쪽 */}
      <ellipse cx="165" cy="95" rx="32" ry="28" fill="#5A8EF5"/>
      <ellipse cx="170" cy="92" rx="22" ry="18" fill="#3B72E8"/>
      {/* 본체 → 종 연결부 */}
      <path d="M120 75 L120 115 L160 110 L160 80 Z" fill="url(#mgBody)"/>
      {/* 노란색 트리거 */}
      <circle cx="70" cy="78" r="10" fill="url(#mgYellow)"/>
      <rect x="60" y="65" width="8" height="8" rx="2" fill="url(#mgYellow)"/>
      {/* 손잡이 */}
      <path d="M85 115 L85 145 Q85 155 95 155 L105 155 Q115 155 115 145 L115 115 Z" fill="url(#mgHandle)"/>
      {/* 입구 하이라이트 */}
      <ellipse cx="140" cy="80" rx="10" ry="5" fill="#fff" opacity="0.6"/>
      {/* 작은 장식 점들 */}
      <circle cx="225" cy="65" r="4" fill="#3B72E8" opacity="0.5"/>
      <circle cx="218" cy="50" r="3" fill="#7BA5F2" opacity="0.5"/>
    </svg>
  );
}
function MegaphoneSmall() {
  return (
    <svg width="100" height="80" viewBox="0 0 240 180">
      <path d="M75 75 Q70 75 70 80 L70 110 Q70 115 75 115 L120 110 L120 80 Z" fill="#fff" opacity="0.7"/>
      <ellipse cx="160" cy="95" rx="55" ry="50" fill="#fff" opacity="0.9"/>
      <ellipse cx="165" cy="95" rx="32" ry="28" fill="#3B72E8" opacity="0.5"/>
      <circle cx="70" cy="78" r="10" fill="#FBBF24"/>
      <path d="M85 115 L85 145 Q85 155 95 155 L105 155 Q115 155 115 145 L115 115 Z" fill="#fff" opacity="0.7"/>
    </svg>
  );
}
function SirenSmall() {
  return (
    <svg width="70" height="70" viewBox="0 0 70 70">
      <defs>
        <linearGradient id="srn" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FF8080"/><stop offset="100%" stopColor="#E04848"/></linearGradient>
      </defs>
      <ellipse cx="35" cy="60" rx="22" ry="4" fill="#1A2340" opacity="0.15"/>
      <rect x="14" y="46" width="42" height="10" rx="3" fill="#5A6680"/>
      <path d="M18 46 L22 22 Q22 14 35 14 Q48 14 48 22 L52 46 Z" fill="url(#srn)"/>
      <ellipse cx="35" cy="20" rx="10" ry="4" fill="#FF9F9F"/>
      <circle cx="35" cy="10" r="3" fill="#FBBF24"/>
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <defs><linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7BA5F2"/><stop offset="100%" stopColor="#3B72E8"/></linearGradient></defs>
      <rect x="6" y="6" width="20" height="22" rx="3" fill="url(#cbg)"/>
      <rect x="10" y="3" width="12" height="5" rx="1.5" fill="#5A6680"/>
      <line x1="11" y1="14" x2="21" y2="14" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
      <line x1="11" y1="18" x2="21" y2="18" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
      <line x1="11" y1="22" x2="17" y2="22" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <defs><linearGradient id="ug" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7BA5F2"/><stop offset="100%" stopColor="#3B72E8"/></linearGradient></defs>
      <circle cx="12" cy="11" r="5" fill="url(#ug)"/>
      <path d="M3 27c0-5 4-8 9-8s9 3 9 8" fill="url(#ug)"/>
      <circle cx="22" cy="13" r="4" fill="#A8C4F8"/>
      <path d="M18 27c0-3.5 2-6 6-6s5 2 5 5" fill="#A8C4F8"/>
    </svg>
  );
}
function IconSiren() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FF8080"/><stop offset="100%" stopColor="#E04848"/></linearGradient></defs>
      <rect x="6" y="22" width="20" height="5" rx="1.5" fill="#5A6680"/>
      <path d="M9 22 L11 12 Q11 6 16 6 Q21 6 21 12 L23 22 Z" fill="url(#sg)"/>
      <ellipse cx="16" cy="10" rx="5" ry="2" fill="#FFB8B8"/>
      <circle cx="16" cy="4" r="2" fill="#FBBF24"/>
    </svg>
  );
}
function IconCheckCircle() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <defs><linearGradient id="ccg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3DC489"/><stop offset="100%" stopColor="#10A26A"/></linearGradient></defs>
      <circle cx="16" cy="16" r="12" fill="url(#ccg)"/>
      <polyline points="10 16 14 20 22 12" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function NavHome() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>; }
function NavCheck() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>; }
function NavList() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>; }
function NavUser() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1"/></svg>; }
function NavWarn() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1"/></svg>; }
