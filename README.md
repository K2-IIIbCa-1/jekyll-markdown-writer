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
```
- `JEKYLL_WRITER_EXCLUDED_DIRECTORIES`: 발행 글 목록과 수정 대상에서 제외할 `_posts` 하위 디렉터리
- `JEKYLL_MEDIA_DIRECTORY`: 새 글의 `media_subpath`를 만들 기준 디렉터리
- `JEKYLL_COMMAND`: 비워두면 Windows는 `bundle.bat`, 그 외 환경은 `bundle`을 사용
</details>

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

`Code block`은 언어, 파일명, `nolineno`(줄 번호 숨김)를 선택해 fenced code block을 삽입합니다. `Media embed`는 현재 테마의 `_includes/embed/` 문법을 사용하므로 YouTube·오디오·비디오 URL을 넣어야 합니다. 오디오·비디오는 아직 파일 업로드 대상이 아니며 외부 URL을 삽입합니다. `Post settings`는 시스템 필드(date·post_id·media_subpath)를 제외한 주요 front matter와 홈/SEO용 `image.path`, `image.alt`를 수정합니다. R2가 설정되어 있으면 대표 이미지도 설정창에서 업로드할 수 있습니다. Liquid를 끄면 Liquid include도 렌더링되지 않으므로 미디어 문법을 사용할 때는 활성화 상태를 유지하세요.

왼쪽 `Posts` 목록에서 기존 글을 열어 수정할 수 있습니다. 기존 글은 `Save changes`로 저장합니다.

## 라이선스

[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)
