# 전세지킴이 — Claude Code 작업 안내

전세사기 예방 교육 웹앱. 프레임워크 없는 순수 HTML/CSS/JS + JSON 콘텐츠. 빌드는 Python 표준 라이브러리만 사용.

## 구조
- `content/*.json` — 모든 교육 콘텐츠(진짜 데이터). 화면 문구 대부분이 여기 있음.
  - lessons(9단계 학습카드·계산기), glossary, checklists(플래너 일정 연동), clauses(특약), insurance,
    policy_updates(최신 제도, 상태 태그), documents(서류 읽는 법 10종), contract_sample(계약서 예시 4종·위험찾기), quiz(223문항·시험 설정), meta
- `src/index.template.html`, `src/style.css`, `src/app.js` — 앱 본체(해시 라우팅 SPA, 상태는 localStorage)
- `tools/build.py` — content + src를 하나로 묶어 `dist/standalone.html`(배포용), `dist/index.html`(Claude 아티팩트용) 생성
- `tools/validate.py` — JSON 간 ID 연결(lessonId, hotspotId, clauseId 등) 검사
- `tools/gen_contracts.py`, `tools/gen_quiz.py` — 계약서 예시·문항 생성기(실행하면 해당 JSON 덮어씀)

## 디자인 (확정)
- 확정안 = A(솜사탕) 그대로: `html[data-design="a"]`가 기본. 핑크·라일락 파스텔, 둥근 카드, 알약 모양 버튼, 주아 제목. (A 톤에 C 버튼만 섞는 안은 어색해서 취소)
- B·C 시안 CSS는 비교용으로 남김: `dist/preview.html`(로컬 서버로 열기)에서 `?design=b|c`로만 보임.
- 첫 화면(인트로)은 항상 밝게. 어두운 톤 금지(불안감을 줌). 메뉴마다 파스텔 고유 색(`[data-design="a"] [data-r=...]`).

## 배포
- 웹 전용으로 개발(안드로이드는 보류, 나중에 앱으로 감쌀 수 있게 콘텐츠는 JSON으로 분리 유지).
- GitHub Pages: `main`에 push → `.github/workflows/deploy.yml`이 validate → build → `dist/standalone.html`을 `index.html`로 배포.
- `dist/`는 git 제외(.gitignore). 로컬 확인용으로만 빌드.

## 명령
```
python3 tools/validate.py && python3 tools/build.py
```
이 Windows PC에서는 `python`/`python3`가 MS 스토어 스텁(exit 49)이라 `py tools/validate.py && py tools/build.py`로 실행.
결과 확인: `dist/standalone.html`을 브라우저로 열기.

## 규칙
- 콘텐츠를 고치면 validate → build 순서로 실행.
- 문항 정답 위치는 고르게 유지(gen_quiz.py가 시드로 섞음). OX는 섞지 않음.
- 법·제도 수치는 기준일(baseDate)과 상태 태그(IN_FORCE / PASSED_PENDING / PROPOSED / PLANNED_SERVICE)를 함께 관리. '추진 중'을 시행된 것처럼 쓰지 않기.
- 현행법상 대항력은 전입신고 다음 날 0시(즉시 발생 개정안은 추진 중, 2026-10 기준).
- 문구는 쉬운 존댓말("~해요"), 경고에는 항상 지금 할 행동을 붙임.
- 학습카드는 초보자 기준: `oneLine`(한 줄 핵심) → `easy`(비유로 쉽게 말하기) → `summary` 3줄(생활 언어, 한 줄 한 가지) → `body`(법·제도 상세, '자세히 알아보기'에 접힘).
  법률 용어는 summary에 되도록 쓰지 말고, 꼭 필요하면 glossary `aliases`에 있는 말로 쓰기(화면에서 자동으로 눌러보는 용어가 됨).
- 교육용 정보이며 법률 자문이 아님(meta.disclaimer).
