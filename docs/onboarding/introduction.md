# 프론트엔드 온보딩 가이드

회의실 예약 시스템(Roombook) 프론트엔드 개발 환경에 오신 것을 환영합니다.

---

## 프로젝트 개요

회의실 예약을 타임테이블 UI로 처리하는 사내 웹앱입니다.

- **주간 뷰**: 시간 슬롯 그리드에서 클릭하여 예약
- **월간 뷰**: 캘린더에서 날짜 클릭하여 예약
- **인증**: Hiworks SSO 연동

---

## 프론트엔드 담당 업무

프론트엔드 개발자는 **UI/UX 디자인**과 **개발**을 모두 담당합니다.

### 디자인 업무

1. **와이어프레임/목업 작성**
   - 간단한 스케치 또는 Figma 등 디자인 툴 사용
   - 주요 화면: 주간 타임테이블, 월간 캘린더, 예약 다이얼로그

2. **UI 컴포넌트 설계**
   - 재사용 가능한 컴포넌트 구조 설계
   - 색상, 폰트, 간격 등 디자인 시스템 정의

3. **반응형 디자인**
   - 데스크톱 우선, 필요 시 태블릿 대응

### 개발 업무

1. **컴포넌트 개발**
   - React 컴포넌트 구현
   - 상태 관리 및 이벤트 처리

2. **API 연동**
   - 백엔드 API와 데이터 통신
   - 로딩/에러 상태 처리

3. **스타일링**
   - CSS/CSS-in-JS로 디자인 구현
   - 애니메이션 및 인터랙션

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Framework | React 18 |
| Build Tool | Vite |
| Language | TypeScript |
| Linter | ESLint |
| Formatter | Prettier |
| Git Hooks | Husky + lint-staged |

---

## 프로젝트 구조

```
roombook/
├── src/                    # 프론트엔드 소스 코드
│   ├── App.tsx            # 메인 앱 컴포넌트
│   ├── main.tsx           # 엔트리 포인트
│   └── ...
├── backend/               # 백엔드 (FastAPI) - 별도 담당자
├── docs/                  # 문서
│   ├── database/          # DB 설계 문서
│   └── onboarding/        # 온보딩 문서 (지금 보고 있는 곳)
├── package.json           # npm 의존성 및 스크립트
├── tsconfig.json          # TypeScript 설정
├── vite.config.ts         # Vite 빌드 설정
├── eslint.config.js       # ESLint 설정
├── .prettierrc            # Prettier 설정
└── .husky/                # Git hooks
```

---

## 개발 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

### 3. 사용 가능한 npm 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 (Hot Reload) |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint 검사 |
| `npm run format` | Prettier로 코드 포맷팅 |
| `npm run format:check` | 포맷 검사만 (수정 없음) |
| `npm run preview` | 빌드된 결과물 미리보기 |

---

## 코드 품질 도구

### ESLint

JavaScript/TypeScript 코드의 문법 오류와 잠재적 버그를 검사합니다.

```bash
npm run lint
```

### Prettier

코드 스타일을 일관되게 포맷팅합니다. 설정은 `.prettierrc` 파일에 있습니다.

```json
{
  "semi": true,           // 세미콜론 사용
  "singleQuote": true,    // 작은따옴표 사용
  "tabWidth": 2,          // 탭 너비 2칸
  "trailingComma": "es5", // 후행 쉼표
  "printWidth": 100       // 한 줄 최대 100자
}
```

```bash
npm run format        # 자동 수정
npm run format:check  # 검사만
```

---

## Git Hooks (Husky)

### Husky란?

Git에서 커밋, 푸시 같은 이벤트가 발생할 때 자동으로 스크립트를 실행하는 도구입니다.

원래 Git hooks는 `.git/hooks/` 폴더에 있어서 버전 관리가 안 되지만, Husky를 사용하면 `.husky/` 폴더에서 관리되어 **팀원 모두 같은 hooks를 공유**할 수 있습니다.

### 현재 설정된 Pre-commit Hook

커밋할 때 자동으로 다음 검사가 실행됩니다:

```bash
# .husky/pre-commit

# Frontend: staged된 ts/tsx 파일만 검사
npx lint-staged

# Backend: Python 코드 검사 (백엔드 담당자용)
cd backend
uv run ruff check --fix .
uv run ruff format .
uv run mypy .
```

### lint-staged란?

Git에 staged된 파일만 검사하는 도구입니다. 전체 프로젝트가 아닌 **변경된 파일만** 검사하므로 빠릅니다.

```json
// package.json
"lint-staged": {
  "src/**/*.{ts,tsx}": [
    "eslint --fix",      // 린트 오류 자동 수정
    "prettier --write"   // 포맷팅 자동 수정
  ]
}
```

### 커밋 시 발생하는 일

1. `git commit` 실행
2. Husky가 `.husky/pre-commit` 스크립트 실행
3. lint-staged가 staged된 ts/tsx 파일에 ESLint + Prettier 실행
4. **검사 통과** → 커밋 완료
5. **검사 실패** → 커밋 거부 (오류 메시지 확인 후 수정 필요)

### 왜 사용하나요?

- 코드 품질을 **강제**할 수 있음
- 리뷰 전에 기본적인 스타일/문법 오류를 잡음
- 팀 전체가 **일관된 코드 스타일** 유지

---

## API 연동

백엔드 API와 통신할 때 다음 규약을 따릅니다.

### Base URL

```
/api
```

### 요청/응답 형식

- Content-Type: `application/json; charset=utf-8`
- Datetime: ISO8601 형식 (예: `2026-01-27T09:00:00+09:00`)
- Timezone: `Asia/Seoul`

### 에러 응답 형식

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자에게 표시할 메시지"
  }
}
```

자세한 API 규약은 [README.md](/README.md#api-규약)를 참고하세요.

---

## Git 워크플로우

### 이슈 기반 개발

모든 작업은 GitHub Issues를 기반으로 진행합니다.

1. [GitHub Issues](https://github.com/yuunicode/roombook/issues)에서 할당된 이슈 확인
2. 이슈 번호를 기반으로 브랜치 생성
3. 작업 완료 후 PR 생성
4. 코드 리뷰 후 main에 머지

### 브랜치 네이밍 규칙

**형식**: `feature/{prefix}-{number}`

| 이슈 타이틀 | 브랜치 이름 |
|-------------|-------------|
| [FE-01-1] 캘린더 라이브러리 조사 | `feature/fe-01-1` |
| [FE-02-1] 주간 타임테이블 그리드 구현 | `feature/fe-02-1` |
| [BE-03-2] GET /timetable?view=week | `feature/be-03-2` |

**브랜치 타입:**
- `feature/` - 새 기능 개발
- `fix/` - 버그 수정
- `hotfix/` - 긴급 수정
- `refactor/` - 리팩토링
- `docs/` - 문서 작업

### 작업 시작하기

```bash
# 1. main 브랜치 최신화
git checkout main
git pull origin main

# 2. 이슈 기반 브랜치 생성 (예: FE-01-1 이슈)
git checkout -b feature/fe-01-1

# 3. 작업 진행...

# 4. 변경사항 커밋
git add .
git commit -m "feat: 캘린더 라이브러리 선정 및 설치"

# 5. 원격에 푸시
git push -u origin feature/fe-01-1
```

### 커밋 메시지 컨벤션

```
<type>: <subject>

예시:
feat: 주간 타임테이블 그리드 컴포넌트 구현
fix: 예약 시간 충돌 검사 오류 수정
style: 캘린더 셀 hover 스타일 추가
refactor: 예약 폼 로직 분리
docs: README에 설치 방법 추가
```

| Type | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `style` | UI/스타일 변경 (기능 변경 없음) |
| `refactor` | 코드 리팩토링 |
| `docs` | 문서 수정 |
| `chore` | 빌드, 설정 파일 수정 |
| `test` | 테스트 코드 추가/수정 |

### PR(Pull Request)란?

PR은 **내 브랜치의 코드를 main 브랜치에 합쳐달라고 요청**하는 것입니다.

```
feature/fe-01-1 (내 작업 브랜치)
        │
        ▼  PR 생성
      main (메인 브랜치)
```

PR을 통해:
- 다른 팀원이 코드를 **리뷰**할 수 있음
- 코드 품질을 **검증**할 수 있음
- 변경 이력이 **기록**됨

---

### PR 생성 방법

#### 방법 1: GitHub 웹 사용 (초보자 권장)

**Step 1.** 브랜치를 원격에 푸시

```bash
git push -u origin feature/fe-01-1
```

**Step 2.** GitHub 저장소 방문
- https://github.com/yuunicode/roombook 접속
- 상단에 노란색 배너 "Compare & pull request" 버튼 클릭

**Step 3.** PR 정보 입력

![PR 생성 화면 예시]
```
┌─────────────────────────────────────────────────────────┐
│  base: main  ←  compare: feature/fe-01-1               │
├─────────────────────────────────────────────────────────┤
│  Title: [FE-01-1] 캘린더 라이브러리 선정                │
├─────────────────────────────────────────────────────────┤
│  Write  │  Preview                                      │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ## Summary                                         │ │
│  │ - FullCalendar 라이브러리 선정                     │ │
│  │ - 주간/월간 뷰 지원 확인                           │ │
│  │                                                    │ │
│  │ ## Test Plan                                       │ │
│  │ - [ ] npm install 후 정상 동작 확인               │ │
│  │                                                    │ │
│  │ Closes #14                                         │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Reviewers: yuunicode  ▼                               │
│  Assignees: reumeum    ▼                               │
│                                                         │
│  ┌─────────────────────┐                               │
│  │  Create pull request │                              │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

**Step 4.** "Create pull request" 버튼 클릭

#### 방법 2: GitHub CLI 사용

```bash
# 브랜치 푸시
git push -u origin feature/fe-01-1

# PR 생성
gh pr create --title "[FE-01-1] 캘린더 라이브러리 선정" --body "## Summary
- FullCalendar 라이브러리 선정
- 주간/월간 뷰 지원 확인

## Test Plan
- [ ] npm install 후 정상 동작 확인
- [ ] 기본 캘린더 렌더링 확인

Closes #14"
```

---

### PR 제목 규칙

**이슈 타이틀과 동일하게** 작성합니다.

```
[FE-01-1] 캘린더 라이브러리 선정
[FE-02-1] 주간 타임테이블 그리드 구현
```

---

### PR 본문 템플릿

```markdown
## Summary
- 작업 내용 요약 (1-3줄)

## Changes
- 변경사항 1
- 변경사항 2

## Test Plan
- [ ] 테스트 항목 1
- [ ] 테스트 항목 2

## Screenshots (선택)
UI 변경이 있으면 스크린샷 첨부

Closes #14
```

#### 각 섹션 설명

| 섹션 | 내용 | 예시 |
|------|------|------|
| **Summary** | 이 PR이 무엇을 하는지 1-3줄로 요약 | "캘린더 라이브러리를 FullCalendar로 선정하고 설치" |
| **Changes** | 구체적인 변경 목록 | "- package.json에 fullcalendar 추가<br>- 기본 Calendar 컴포넌트 생성" |
| **Test Plan** | 어떻게 테스트했는지 또는 해야 하는지 | "- [ ] npm run dev로 캘린더 렌더링 확인" |
| **Screenshots** | UI 변경 시 전후 스크린샷 | 이미지 드래그앤드롭 |
| **Closes #N** | 연결된 이슈 번호 | "Closes #14" → 머지 시 이슈 자동 종료 |

---

### PR 생성 후 프로세스

```
1. PR 생성
     │
     ▼
2. 리뷰어가 코드 리뷰
     │
     ├─→ 수정 요청(Request Changes) → 코드 수정 후 다시 푸시 → 2로 돌아감
     │
     ▼
3. 승인(Approve)
     │
     ▼
4. main에 머지(Merge)
     │
     ▼
5. 연결된 이슈 자동 종료
```

#### 리뷰 받은 후 수정하기

리뷰어가 수정을 요청하면:

```bash
# 1. 코드 수정

# 2. 변경사항 커밋
git add .
git commit -m "fix: 리뷰 반영 - 변수명 수정"

# 3. 같은 브랜치에 푸시 (PR에 자동 반영됨)
git push
```

> 새 PR을 만들 필요 없이, 같은 브랜치에 푸시하면 기존 PR에 커밋이 추가됩니다.

#### 머지 후 정리

PR이 머지되면:

```bash
# 1. main 브랜치로 이동
git checkout main

# 2. 최신 코드 가져오기
git pull origin main

# 3. 작업했던 브랜치 삭제 (선택)
git branch -d feature/fe-01-1
```

---

### PR 체크리스트

PR 생성 전 확인사항:

- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] 커밋 메시지가 컨벤션에 맞음
- [ ] 불필요한 console.log 제거
- [ ] PR 제목이 이슈 타이틀과 일치
- [ ] (UI 변경 시) 스크린샷 첨부

---

## 다음 단계

### Day 1: 환경 설정
1. `npm install && npm run dev`로 개발 환경 확인
2. `http://localhost:5173` 접속하여 앱 동작 확인
3. `src/App.tsx` 파일을 수정해보고 Hot Reload 동작 확인

### Day 2: Git 워크플로우 연습
4. 테스트 브랜치 생성: `git checkout -b test/my-first-branch`
5. 작은 변경 후 커밋해보고 pre-commit hook 동작 확인
6. (선택) 테스트 PR 생성해보기

### Day 3~: 실제 작업 시작
7. [GitHub Issues](https://github.com/yuunicode/roombook/issues)에서 할당된 태스크 확인
8. 첫 번째 이슈 브랜치 생성하고 작업 시작
9. 작업 완료 후 PR 생성

---

## 자주 묻는 질문 (FAQ)

### Q: pre-commit hook에서 에러가 나면?
린트/포맷 오류입니다. 에러 메시지를 확인하고 수정한 후 다시 커밋하세요.
```bash
npm run lint   # 에러 확인
npm run format # 자동 수정
git add .
git commit -m "feat: ..."
```

### Q: PR 생성 후 추가 수정이 필요하면?
같은 브랜치에서 수정 후 푸시하면 PR에 자동 반영됩니다.
```bash
# 수정 후
git add .
git commit -m "fix: 리뷰 반영"
git push
```

### Q: main 브랜치가 업데이트됐는데 내 브랜치에 반영하려면?
```bash
git checkout main
git pull origin main
git checkout feature/fe-01-1
git merge main
# 충돌 발생 시 해결 후
git push
```

### Q: 커밋을 잘못했어요. 되돌리려면?
```bash
# 마지막 커밋 취소 (변경사항은 유지)
git reset --soft HEAD~1

# 수정 후 다시 커밋
git add .
git commit -m "feat: 올바른 메시지"
```

---

궁금한 점이 있으면 언제든 질문하세요!
