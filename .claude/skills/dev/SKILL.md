---
name: dev
description: >
  태스크 구현 전담. TDD(RED→GREEN→REFACTOR) + Agent Team 기본.
  /feat에서 생성된 태스크를 구현. 설계/분석/태스크 생성은 하지 않음.
  인자 없이 호출 시 plan.md에서 우선순위 높은 미완료 태스크 자동 선택.
disable-model-invocation: true
---

## 미완료 태스크 현황 (자동 주입)
!`grep -r '\[ \]\|\[→\]' docs/specs/*/plan.md 2>/dev/null | head -15 || echo "미완료 태스크 없음"`

태스크를 구현합니다. TDD 사이클: RED → GREEN → REFACTOR

## Step 1: 태스크 선택

**인자가 있는 경우**: 지정된 태스크로 진행

**인자가 없는 경우**: docs/specs/*/plan.md에서 자동 선택
1. [ ] 상태인 태스크 목록 조회
2. 의존성 충족 태스크만 필터
3. 우선순위 순서로 정렬, 최상위 태스크 선택
4. 사용자에게 확인

## Step 2: 태스크 → In Progress

1. plan.md에서 해당 태스크의 `[ ]`를 `[→]`로 변경
2. PM 도구 연동 시 (jira/linear): 해당 Sub-task(Jira) / Sub-issue(Linear) → In Progress

## Step 2.5: 외부 의존성 확인

design.md와 plan.md를 검토하여 외부 의존성이 있는지 확인:
- 외부 API 연동 (결제, 인증, 메일, SMS 등)
- 서드파티 서비스 접속 정보 (API Key, Secret, URL 등)
- 아직 결정되지 않은 비즈니스 규칙

필요한 정보가 없으면 → 사용자에게 질문 후 대기. 임의로 추정하여 진행하지 않는다.
.env에 해당 변수가 이미 존재하면 → 진행.

## Step 3: RED — 실패하는 테스트 작성 (test-runner 에이전트)

1. test-spec.md의 테스트 명세 읽기
2. 실패하는 테스트 코드 작성 (실제 assertion, test.todo 금지)
3. 테스트 실행 → FAIL 확인

## Step 4: GREEN — 구현 (Agent Team)

plan.md의 "병렬 실행 판단" 확인:

### Agent Team (기본: 백엔드 + 프론트엔드 모두 있는 경우)

**4-1. worktree 생성:**
```
bash .claude/scripts/worktree-setup.sh {기능명} backend frontend
```

**4-2. Agent Team 생성 및 팀원 spawn:**

TeamCreate로 팀 생성 후, Task 도구로 팀원을 각각 spawn한다:

| 팀원 name | subagent_type | prompt에 포함할 작업 디렉토리 | 역할 |
|-----------|---------------|-------------------------------|------|
| backend | general-purpose | `.worktrees/{기능명}-backend/` | [backend] 태스크 구현 + TDD GREEN |
| frontend | general-purpose | `.worktrees/{기능명}-frontend/` | [frontend] 태스크 구현 + TDD GREEN |

각 팀원의 Task prompt에 반드시 포함:
- 작업 디렉토리: `cd {프로젝트 루트}/.worktrees/{기능명}-{역할}/` 에서 작업
- 참조할 설계서 경로: `docs/specs/{기능명}/design.md`, `plan.md`
- 해당 역할의 에이전트 정의 참조: `.claude/agents/{역할}-dev.md`의 지침을 따를 것
- GREEN 달성 후 팀 리더에게 완료 보고

**4-3. 팀원 완료 대기:**
- 두 팀원 모두 완료 보고할 때까지 대기
- 팀원이 사용자 정보가 필요하다고 보고하면 → 사용자에게 전달 후 대기

### 단일 에이전트 (프론트 또는 백 Only)
해당 에이전트만 직접 호출 (Agent Team 불필요)

## Step 5: Merge

```
bash .claude/scripts/worktree-merge.sh {기능명} backend frontend
```

충돌 해결 불가 시 → 멈추고 사용자에게 보고

## Step 6: REFACTOR — quality-gate 검증

quality-gate 에이전트 호출:
- 보안 + 성능 + 코드/설계/문서 리뷰 + 시각 검증 (ui-spec.md 존재 시)

Critical 이슈 발견:
1. 해당 에이전트(backend-dev/frontend-dev)에게 수정 요청
2. quality-gate 재실행
3. 2회 시도 후에도 실패 → 멈추고 사용자에게 보고

Warning: 자동으로 해당 에이전트에게 수정 요청 후 진행

## Step 7: 로컬 확인 (Chrome DevTools MCP)

- quality-gate 통과 후 Chrome DevTools MCP로 자동 캡처
- 대상: ui-spec.md에 정의된 각 화면의 주요 상태
- 서버 기동: 사용자가 요청한 경우에만 (기본적으로 이미 실행 중인 서버 전제)
- 캡처 결과는 docs/tests/{feature}/{timestamp}.md에 추가

## Step 8: 사후 문서 작성

- backend-dev: docs/api/{feature}.md (구현된 API 스펙 확정본)
- backend-dev: docs/db/{feature}.md (DB 스키마 확정본)
- frontend-dev: docs/components/ (필요 시 컴포넌트 문서)

## Step 9: 커밋 (자동)

사용자 확인 없이 즉시 커밋 실행 (파이프라인 내 자동 단계):
1. `git status`로 변경사항 확인
2. 논리적 단위로 분리하여 Conventional Commits 형식으로 커밋:
   - 구현 코드: `feat: {기능명} 구현`
   - 테스트: `test: {기능명} 테스트 추가`
   - 사후 문서: `docs: {기능명} API/DB 스펙 확정`
3. features.md 해당 기능 상태를 "✅ 완료"로 업데이트

> push는 하지 않음. 사용자가 준비되면 `git push`로 직접 반영.
> 독립 실행(standalone) 커밋은 /commit 스킬 사용.

## Step 10: 태스크 → Done

1. plan.md에서 `[→]`를 `[x]`로 변경
2. PM 도구 연동 시 (jira/linear): 해당 Sub-task(Jira) / Sub-issue(Linear) → Done
3. 기능의 모든 태스크 완료 시:
   - features.md 상태 → "✅ 완료"
   - PM 도구: Story(Jira) / Issue(Linear) → Done
4. 마일스톤 내 모든 기능 ✅ 또는 ❌ 시:
   - PM 도구: Epic(Jira) / Milestone(Linear) 닫기

> MCP 미응답 시 features.md/plan.md만 업데이트하고 경고 출력 후 계속 진행.

## 완료 보고

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
완료: {기능명}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

완료된 태스크:
- [x] {태스크 1}
- [x] {태스크 2}

생성된 문서:
- docs/api/{기능명}.md
- docs/db/{기능명}.md
- docs/tests/{기능명}/{YYYY-MM-DD-HHmm}.md

다음 단계: /dev (다음 태스크) 또는 /auto-dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

태스크 ID 또는 기능명: $ARGUMENTS
