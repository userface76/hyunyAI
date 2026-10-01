# hyunyAI Cloudflare D1 연결

hyunyAI는 `HYUNY_DB`라는 Cloudflare D1 binding을 사용합니다.

## Cloudflare에서 한 번만 할 일

1. Cloudflare Dashboard에서 **Storage & Databases → D1 SQL Database**로 이동
2. 새 D1 데이터베이스 생성
   - 권장 이름: `hyunyai-memory`
3. 현재 배포된 **hyunyai** Worker/Pages 프로젝트로 이동
4. **Settings → Bindings → Add binding → D1 database**
5. Variable name에 정확히 `HYUNY_DB` 입력
6. Database에서 `hyunyai-memory` 선택
7. 저장 후 재배포

별도 SQL 실행은 필수가 아닙니다.
`/api/memory`가 처음 호출될 때 필요한 테이블을 자동 생성합니다.

전체 SQL 원본은 `db/schema.sql`에도 보관합니다.

## 저장되는 데이터

- 최근 대화
- 창작 기억
- 현재 대화 모드
- 향후 Small LLM 학습용 대화 후보

학습 후보는 자동으로 학습에 사용하지 않고 `approved=0` 상태로 저장됩니다.
나중에 좋은 대화만 골라 JSONL 학습데이터로 내보내는 구조로 확장합니다.

## 개인정보 원칙

공개 GitHub에는 실제 대화 원문을 저장하지 않습니다.
대화 원문은 비공개 D1에만 저장합니다.
