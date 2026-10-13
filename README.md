# 전세지킴이 — 웹 버전

전세사기 예방 교육 웹앱. 휴대폰·PC 어디서나 브라우저로 열 수 있어요.

## 바로 쓰기
- `dist/standalone.html` 하나가 완성된 웹앱이에요(콘텐츠·스타일·스크립트 모두 포함).
- 이 파일을 `index.html`로 이름만 바꿔 GitHub Pages, Netlify, Vercel 등에 올리면 바로 공개 웹사이트가 됩니다.
- 플래너·오답노트 기록은 사용자 브라우저(localStorage)에만 저장돼요. 서버가 필요 없어요.

## 무료 배포 (GitHub Pages, 자동)
`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 검사(validate) → 빌드(build) → 배포를 자동으로 해요.
`dist/`는 git에 올리지 않아요(CI가 매번 새로 만듦). 검사에서 오류가 나면 배포되지 않아요.

처음 한 번만:
1. GitHub에서 새 저장소 만들기 (Public — 무료 Pages는 공개 저장소에서 사용)
2. `git remote add origin https://github.com/<아이디>/<저장소>.git` → `git push -u origin main`
3. 저장소 **Settings → Pages → Source: GitHub Actions** 선택
4. Actions 탭에서 완료되면 `https://<아이디>.github.io/<저장소>/` 로 접속

이후에는 콘텐츠를 고치고 commit → push만 하면 1~2분 뒤 사이트에 반영돼요.

## 폴더 구조
```
content/   교육 콘텐츠 JSON (앱의 '진짜 데이터' — 웹·안드로이드 공용)
  meta.json · policy_updates.json · lessons.json · glossary.json · checklists.json
  clauses.json · insurance.json · contract_sample.json · documents.json · quiz.json
src/       index.template.html · style.css · app.js (프레임워크 없는 순수 JS)
tools/     build.py(빌드) · validate.py(ID 연결 검사) · gen_contracts.py · gen_quiz.py
dist/      index.html(Claude 아티팩트용) · standalone.html(일반 호스팅용)
```

## 콘텐츠를 고친 뒤
```
python3 tools/validate.py   # 끊어진 ID 연결이 있으면 알려줌
python3 tools/build.py      # dist/ 다시 생성
```
`gen_contracts.py`, `gen_quiz.py`는 계약서 예시·문항을 다시 만들 때만 실행하세요(실행하면 해당 JSON을 덮어씀).

## 들어 있는 것 (2026-10-13 기준)
- 9단계 학습카드 24개, 용어 21개, 최신 제도 12건, 알려진 사기 수법 13가지(대표·신종)
- 서류 읽는 법 10종: 등기사항전부증명서, 건축물대장(집합·다가구), 중개대상물 확인·설명서, 전입세대 확인서,
  확정일자 부여현황, 납세증명서, 신탁원부, 주민등록등본, 임대차 신고필증, 전세보증금반환보증서 — 견본 + 눌러보는 해설 + 투어
- 계약서 예시 4종: 아파트 전세 / 빌라 전세(위험) / 다가구 전세(선순위) / 오피스텔 보증금 월세 + 위험 찾기 게임 2종
- 내 계약 플래너: 날짜 → 자동 일정·D-day, 상황별 체크리스트, 위험 진단, 특약 생성·복사, 백업/불러오기
- 보증보험 비교 + 계산기 3종(전세가율, 126% 룰, 보증료)
- 문제은행 223문항, 실전 모의고사 2회 + 문서 읽기 모의고사 + 단원 퀴즈 + 오답노트 + 수료 배지

## 주의
교육용 정보이며 법률 자문이 아닙니다. '추진 중' 제도(대항력 즉시 발생 등)와 보증료율은 출시·배포 전에 공식 기관에서 다시 확인하세요.
