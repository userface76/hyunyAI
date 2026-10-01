# hyunyAI 웹앱

## 현재 기능
- 세계관 / 게임 / 이야기 / 만들기 자료 자동 목록화
- 저장된 Markdown 원문 열람
- 전체 창작 자료 기반 키워드 검색
- 캐릭터 인덱스
- 채팅 UI
- 질문과 관련된 기억 자동 검색
- AI API 미설정 시에도 동작하는 로컬 기억 대화 모드
- OpenAI-compatible API 연결용 Cloudflare Pages Function

## Cloudflare Pages 배포
GitHub 저장소 `userface76/hyunyAI`를 Cloudflare Pages에 연결합니다.

정적 파일은 저장소 루트에 있고, `functions/api/chat.js`는 Pages Functions로 동작합니다.

### AI 대화 연결
Cloudflare 프로젝트의 환경 변수/Secret에 다음 값을 설정합니다.

- `AI_API_URL` : OpenAI-compatible chat completions endpoint
- `AI_API_KEY` : API Secret
- `AI_MODEL` : 사용할 모델 이름

API 키는 절대로 GitHub 파일이나 브라우저 JavaScript에 직접 넣지 않습니다.

## 데이터 확장 방법
새 자료를 추가한 뒤 `data/memory/creative-index.json`에 항목을 등록하면 웹앱 목록과 검색 대상에 자동으로 포함됩니다.

## 개인정보 원칙
이 저장소는 현재 public이므로 **개인정보나 전체 대화 원문을 저장하지 않습니다.**
저장 대상은 세계관, 게임 규칙, 캐릭터, 만들기 방법 등 창작 데이터 중심으로 유지하는 것을 권장합니다.
실제 개인 대화 기록까지 저장하려면 저장소를 private으로 전환하고 별도의 인증/DB를 사용하는 구조가 좋습니다.
