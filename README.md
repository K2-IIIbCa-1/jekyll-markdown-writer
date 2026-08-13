# Jekyll Markdown Writer
<div align="center">
<img src="screenshot/screenshot.png" width="70%">

![](https://img.shields.io/badge/Made_With-Codex-white)
[![](https://img.shields.io/badge/For-Chirpy_Jekyll_Theme-black)](https://github.com/cotes2020/jekyll-theme-chirpy)
[![](https://img.shields.io/badge/Works_With-Cloudflare_R2-orange)](https://www.cloudflare.com/ko-kr/developer-platform/products/r2/)

</div>



Jekyll 저장소에서 글을 작성하고 `_drafts/`, `_posts/`를 관리하는 로컬 Markdown 편집기입니다.

- CodeMirror 기반 Markdown·코드 구문 하이라이팅
- 코드블록 언어·파일명·줄 번호 표시 여부 설정
- YouTube·오디오·비디오 URL용 Jekyll include 삽입
- 선택 영역 굵게·기울임·취소선 토글 및 테마 색상/배경 강조 팔레트
- Tip·Info·Warning·Danger 프롬프트 프리셋
- 게시글 설정창에서 description·categories·tags·대표 이미지·옵션 front matter 수정
- AI provider·API key·model을 입력해 description 초안 자동 생성
- front matter와 일부 문법 검사
- Jekyll 미리보기 실행 및 링크
- Cloudflare R2 토큰 연결을 통한 빠른 이미지 업로드

## 빠른 시작

`tools/blog-writer`를 Jekyll 저장소 안에 둡니다.

```text
my-blog/
├─ _config.yml
├─ _posts/
├─ _drafts/
└─ tools/
   └─ blog-writer/
```

도구 폴더에서 실행합니다.

```powershell
Copy-Item .env.example .env
npm install
npm start
```

Windows에서는 `start.cmd`를 실행해도 됩니다. 이후 <http://127.0.0.1:4170>을 엽니다.

도구를 다른 위치에 두려면 `.env`의 `JEKYLL_ROOT`에 대상 Jekyll 저장소 경로를 지정합니다.

## 설정

<details>
<summary>선택 설정 사항</summary>

대부분의 경우 `.env.example`의 기본값으로 충분합니다.
자주 바꾸는 항목은 다음과 같습니다.

```text
JEKYLL_ROOT=
JEKYLL_DRAFTS_DIRECTORY=_drafts
JEKYLL_POSTS_DIRECTORY=_posts
JEKYLL_WRITER_EXCLUDED_DIRECTORIES=demo,preset
JEKYLL_MEDIA_DIRECTORY=images
JEKYLL_COMMAND=
JEKYLL_PORT=4000
BLOG_WRITER_PORT=4170
JEKYLL_GIT_ENABLED=true
```
- `JEKYLL_WRITER_EXCLUDED_DIRECTORIES`: 발행 글 목록과 수정 대상에서 제외할 `_posts` 하위 디렉터리
- `JEKYLL_MEDIA_DIRECTORY`: 새 글의 `media_subpath`를 만들 기준 디렉터리
- `JEKYLL_COMMAND`: 비워두면 Windows는 `bundle.bat`, 그 외 환경은 `bundle`을 사용
- `JEKYLL_GIT_ENABLED`: 편집기에서 연결된 블로그 저장소의 Git 기능을 사용할지 여부
</details>

### AI description 설정

AI 설정은 `.env`에 기본값으로 넣어둘 수 있습니다.

```text
AI_PROVIDER=openai
AI_MODEL=
AI_API_KEY=
AI_ENDPOINT=
```

`AI_API_KEY`가 있으면 편집기의 AI description 설정에서 API key를 비워도 해당 키가 사용됩니다. provider·model·endpoint는 브라우저의 로컬 설정에 자동으로 기억되며, API key는 기본적으로 저장하지 않습니다. 개인 컴퓨터에서만 키를 기억하려면 설정창의 `Remember API key on this computer`를 선택할 수 있지만, 브라우저 local storage에 평문으로 저장되므로 공유 컴퓨터에서는 사용하지 마세요. `.env`와 local storage 모두 Git에 커밋하지 않는 것을 권장합니다.

### Cloudflare R2 이미지 업로드

R2를 사용하지 않으면 아래 항목을 비워둡니다.

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_JURISDICTION=default
R2_REGION=auto
R2_PUBLIC_BASE_URL=
R2_ENDPOINT=
```

`R2_PUBLIC_BASE_URL`은 업로드한 이미지를 브라우저에서 읽을 수 있는 공개 URL입니다. `R2_ENDPOINT`를 비워두면 Account ID와 jurisdiction으로 자동 구성됩니다. 비밀값은 `.env`에만 저장하고 Git에 커밋하지 마세요.

이미지는 글의 `media_subpath`를 기준으로 버킷에 저장됩니다. 기본 경로는 다음과 같습니다.

```text
images/YYYY-MM-DD_HHMMSS/screenshot.png
```

초안을 만든 시점의 서울 시간(KST, `Asia/Seoul`)으로 `post_id`를 만들고, 이를 이미지 폴더명에 사용합니다. 같은 이름의 파일이 이미 있으면 `screenshot-01.png`, `screenshot-02.png`처럼 저장됩니다. 글을 발행할 때 기록되는 front matter의 `date`와 `_posts/` 파일명은 발행 시점의 KST를 기준으로 하며, 기존 이미지 폴더는 바뀌지 않습니다.


## 사용법

1. `New draft`에서 제목과 필요한 메타데이터를 입력해 초안을 만듭니다.
2. 편집기에서 Markdown을 작성합니다. 여러 프리셋 버튼들로 문법/이미지를 삽입할 수 있습니다.
3. `Save` 또는 `Ctrl/Cmd + S`로 저장합니다.
4. `Validate`로 front matter, 닫히지 않은 코드 블록, Mermaid·MathJax 사용 여부를 확인합니다.
5. `Preview`를 켜면 Jekyll 서버가 실행됩니다. `Open Jekyll`로 실제 테마에서 확인합니다.
6. R2가 설정되어 있으면 `Upload image`로 이미지를 업로드하고 Markdown을 현재 커서 위치에 삽입합니다.
7. `Publish`는 초안에 현재 시각을 `date`로 기록하고 `_posts/`로 이동합니다.
8. 필요하면 상단의 `Git status`에서 변경 파일을 확인하고 `Commit`, `Push`를 순서대로 실행합니다.

`Code block`은 언어, 파일명, `nolineno`(줄 번호 숨김)를 선택해 fenced code block을 삽입합니다. `Media embed`는 현재 테마의 `_includes/embed/` 문법을 사용하므로 YouTube·오디오·비디오 URL을 넣어야 합니다. 오디오·비디오는 아직 파일 업로드 대상이 아니며 외부 URL을 삽입합니다. `Post settings`는 시스템 필드(date·post_id·media_subpath)를 제외한 주요 front matter와 홈/SEO용 `image.path`, `image.alt`를 수정합니다. R2가 설정되어 있으면 대표 이미지도 설정창에서 업로드할 수 있습니다. Liquid를 끄면 Liquid include도 렌더링되지 않으므로 미디어 문법을 사용할 때는 활성화 상태를 유지하세요.
`AI description settings`에서 provider·API key·model을 설정한 뒤, 설정창 바깥의 `Auto generate` 버튼으로 본문 설명을 생성합니다. 결과는 Description 입력란에만 채워지며 `Apply`를 눌러야 저장됩니다. API key는 `.env`에서 읽거나 현재 에디터 세션에 임시로 입력할 수 있고, 선택한 경우에만 브라우저에 기억됩니다. 본문 일부가 선택한 외부 provider로 전송되므로 민감한 내용은 제외하고 사용하세요.

Google Gemini 3.5 Flash-Lite를 사용하려면 다음처럼 입력합니다.

```text
Provider: Google Gemini
Model: gemini-3.5-flash-lite
Endpoint: 입력하지 않음
API key: Google AI Studio에서 발급한 Gemini API key
```

또는 `.env`에 아래처럼 저장하면 편집기에서 API key를 다시 입력하지 않아도 됩니다.

```text
AI_PROVIDER=gemini
AI_MODEL=gemini-3.5-flash-lite
AI_API_KEY=your-gemini-api-key
AI_ENDPOINT=
```

Google Gemini의 공식 모델 ID는 `gemini-3.5-flash-lite`이며, 이 도구는 Gemini의 `generateContent` API를 사용합니다. `Endpoint`는 Gemini 선택 시 비워두세요. [Gemini 모델 목록](https://ai.google.dev/gemini-api/docs/models)과 [Gemini 3.5 Flash-Lite 안내](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)에서 현재 모델 ID와 상태를 확인할 수 있습니다.

왼쪽 `Posts` 목록에서 기존 글을 열어 수정할 수 있습니다. 기존 글은 `Save changes`로 저장합니다.

### 블로그 저장소 Git 작업

편집기의 Git 기능은 편집기 저장소가 아니라 `JEKYLL_ROOT`로 지정된 블로그 저장소에서 실행됩니다. 별도 저장소에 편집기를 두는 경우 `.env`에 블로그 루트를 지정하세요.

```text
JEKYLL_ROOT=K:/Personal Files/Code_Personal/arietis_blog
```

권장 순서는 다음과 같습니다.

```text
Save → Validate → Publish → Git status → Commit → Push
```

`Git status`는 현재 브랜치, origin, 변경 파일을 표시합니다. 안전을 위해 `_posts/` 아래 Markdown 파일만 변경된 경우에만 `Commit`을 활성화하며, 다른 파일이나 `_posts/demo`, `_posts/preset` 변경이 있으면 커밋을 막습니다. 편집기 자신인 `tools/blog-writer` 서브모듈 변경은 블로그 게시글 작업과 무관하므로 상태에서 제외합니다. `Commit`은 메시지를 입력받아 해당 게시글 파일만 stage하고, `Push`는 작업 트리가 깨끗할 때 현재 브랜치의 upstream으로 실행합니다.

GitHub 인증은 편집기에 저장하지 않습니다. PC에 설정된 SSH 키나 Git Credential Manager를 사용합니다. 인증 prompt를 띄우지 않도록 비대화형으로 실행하므로, 먼저 PC에서 해당 저장소의 `git push`가 정상적으로 되는지 확인하세요. `Publish`는 파일만 변경하고 자동으로 commit/push하지 않습니다.

## 라이선스

[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)
