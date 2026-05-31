import { createClient } from "@supabase/supabase-js";

// 환경변수에서 접속 정보를 읽어옵니다 (.env 파일에 작성).
// Vite 프로젝트는 VITE_ 접두사가 붙은 변수만 코드에서 읽을 수 있습니다.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

if (!url || !key) {
  console.error(
    "Supabase 접속 정보가 없습니다. .env 파일에 VITE_SUPABASE_URL 과 VITE_SUPABASE_KEY 를 설정했는지 확인하세요."
  );
}

export const supabase = createClient(url, key);

// 캡처 이미지를 저장할 Storage 버킷 이름
export const PROOF_BUCKET = "proofs";
