import { basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { yaml } from '@codemirror/lang-yaml';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { c, clike, cpp, csharp, dart, java, kotlin, scala, shader } from '@codemirror/legacy-modes/mode/clike';
import { go } from '@codemirror/legacy-modes/mode/go';
import { rust } from '@codemirror/legacy-modes/mode/rust';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { standardSQL } from '@codemirror/legacy-modes/mode/sql';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { protobuf } from '@codemirror/legacy-modes/mode/protobuf';
import { groovy } from '@codemirror/legacy-modes/mode/groovy';
import { haskell } from '@codemirror/legacy-modes/mode/haskell';
import { julia } from '@codemirror/legacy-modes/mode/julia';
import { r } from '@codemirror/legacy-modes/mode/r';
import { fSharp } from '@codemirror/legacy-modes/mode/mllike';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { oneDarkTheme } from '@codemirror/theme-one-dark';
import { HighlightStyle, LanguageDescription, LanguageSupport, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const legacyLanguage = (name, alias, parser) => LanguageDescription.of({
  name,
  alias,
  support: new LanguageSupport(StreamLanguage.define(parser))
});

const words = (value) => Object.fromEntries(value.split(/\s+/u).filter(Boolean).map((word) => [word, true]));

const hlslTypes = words(`
  bool bool1 bool2 bool3 bool4
  int int1 int2 int3 int4
  uint uint1 uint2 uint3 uint4
  dword dword1 dword2 dword3 dword4
  half half1 half2 half3 half4
  float float1 float2 float3 float4
  double double1 double2 double3 double4
  min10float min16float min12int min16int min16uint
  bool1x1 bool1x2 bool1x3 bool1x4 bool2x1 bool2x2 bool2x3 bool2x4 bool3x1 bool3x2 bool3x3 bool3x4 bool4x1 bool4x2 bool4x3 bool4x4
  int1x1 int1x2 int1x3 int1x4 int2x1 int2x2 int2x3 int2x4 int3x1 int3x2 int3x3 int3x4 int4x1 int4x2 int4x3 int4x4
  uint1x1 uint1x2 uint1x3 uint1x4 uint2x1 uint2x2 uint2x3 uint2x4 uint3x1 uint3x2 uint3x3 uint3x4 uint4x1 uint4x2 uint4x3 uint4x4
  half1x1 half1x2 half1x3 half1x4 half2x1 half2x2 half2x3 half2x4 half3x1 half3x2 half3x3 half3x4 half4x1 half4x2 half4x3 half4x4
  float1x1 float1x2 float1x3 float1x4 float2x1 float2x2 float2x3 float2x4 float3x1 float3x2 float3x3 float3x4 float4x1 float4x2 float4x3 float4x4
  double1x1 double1x2 double1x3 double1x4 double2x1 double2x2 double2x3 double2x4 double3x1 double3x2 double3x3 double3x4 double4x1 double4x2 double4x3 double4x4
  matrix vector
  Texture1D Texture1DArray Texture2D Texture2DArray Texture3D TextureCube TextureCubeArray
  Buffer StructuredBuffer RWBuffer RWStructuredBuffer ByteAddressBuffer RWByteAddressBuffer
  AppendStructuredBuffer ConsumeStructuredBuffer RaytracingAccelerationStructure
  SamplerState SamplerComparisonState sampler sampler1D sampler2D sampler3D samplerCUBE
`);

const hlslKeywords = words(`
  asm asm_fragment break case catch class const continue default discard do else export extern for friend
  if inline in inout interface line namespace nointerpolation noinline out packoffset precise register
  restrict return static struct switch template this typedef typename uniform union unroll while
  groupshared globallycoherent volatile cbuffer tbuffer row_major column_major snorm unorm
`);

const hlslBuiltins = words(`
  abs acos all any asfloat asint asin asuint atan atan2 ceil clamp countbits cos cross ddx ddy degrees
  determinant distance dot exp exp2 floor fmod frac isfinite isinf isnan ldexp length lerp log log10
  log2 max min mul normalize pow radians reflect refract reversebits round rsqrt saturate sign sin sinh
  smoothstep sqrt step tan tanh transpose trunc
  Load Sample SampleBias SampleCmp SampleCmpLevelZero SampleGrad SampleLevel
  tex1D tex2D tex3D texCUBE tex2Dlod tex2Dproj
  InterlockedAdd InterlockedAnd InterlockedCompareExchange InterlockedExchange InterlockedMax InterlockedMin InterlockedOr InterlockedXor
`);

const hlslParser = clike({
  name: 'hlsl',
  keywords: hlslKeywords,
  types: hlslTypes,
  builtin: hlslBuiltins,
  blockKeywords: words('for while do if else switch struct class namespace'),
  atoms: words('true false NULL nullptr'),
  namespaceSeparator: '.'
});

const shaderLabParser = clike({
  name: 'shaderlab',
  keywords: {
    ...hlslKeywords,
    ...words(`
      Shader Properties SubShader Pass GrabPass Category Fallback CustomEditor UsePass
      Tags LOD Name LightMode Stencil Ref ReadMask WriteMask Comp Front Back CompFront CompBack
      Blend BlendOp BlendOpAlpha ColorMask Cull ZClip ZTest ZWrite Offset Conservative Raster
      HLSLPROGRAM ENDHLSL CGPROGRAM ENDCG GLSLPROGRAM ENDGLSLPROGRAM
      Include Compile Debug Define Target OnlyRenderers ExcludeRenderers
    `)
  },
  types: {
    ...hlslTypes,
    ...words('Color Vector Range Float Int 2D 3D Cube Cubemap Any')
  },
  builtin: {
    ...hlslBuiltins,
    ...words('UnityObjectToClipPos TRANSFORM_TEX UNITY_MATRIX_MVP UNITY_MATRIX_MV UNITY_MATRIX_IT_MV')
  },
  blockKeywords: words('Shader Properties SubShader Pass GrabPass Category Tags Stencil HLSLPROGRAM CGPROGRAM'),
  atoms: words('true false'),
  namespaceSeparator: '.'
});

const codeLanguages = [
  LanguageDescription.of({ name: 'TypeScript', alias: ['ts', 'typescript'], support: javascript({ typescript: true }) }),
  LanguageDescription.of({ name: 'TSX', alias: ['tsx'], support: javascript({ typescript: true, jsx: true }) }),
  LanguageDescription.of({ name: 'JSX', alias: ['jsx'], support: javascript({ jsx: true }) }),
  LanguageDescription.of({ name: 'JavaScript', alias: ['js', 'javascript', 'mjs', 'cjs'], support: javascript() }),
  LanguageDescription.of({ name: 'YAML', alias: ['yml', 'yaml'], support: yaml() }),
  LanguageDescription.of({ name: 'Python', alias: ['py', 'python'], support: python() }),
  LanguageDescription.of({ name: 'JSON', alias: ['json'], support: json() }),
  LanguageDescription.of({ name: 'CSS', alias: ['css', 'scss'], support: css() }),
  LanguageDescription.of({ name: 'HTML', alias: ['html', 'xml'], support: html() }),
  legacyLanguage('C', ['c', 'h'], c),
  legacyLanguage('C++', ['c++', 'cpp', 'cc', 'cxx', 'hpp', 'hxx'], cpp),
  legacyLanguage('C#', ['c#', 'csharp', 'cs', 'dotnet'], csharp),
  legacyLanguage('Java', ['java'], java),
  legacyLanguage('Go', ['go', 'golang'], go),
  legacyLanguage('Rust', ['rs', 'rust'], rust),
  legacyLanguage('Kotlin', ['kt', 'kts', 'kotlin'], kotlin),
  legacyLanguage('Swift', ['swift'], swift),
  legacyLanguage('Dart', ['dart'], dart),
  legacyLanguage('Scala', ['scala'], scala),
  legacyLanguage('GLSL', ['shader', 'glsl'], shader),
  legacyLanguage('HLSL', ['hlsl', 'hlsli', 'fx', 'fxh', 'cg', 'cginc'], hlslParser),
  legacyLanguage('ShaderLab', ['shaderlab', 'shader-lab', 'unity-shader', 'unityshader'], shaderLabParser),
  legacyLanguage('Shell', ['bash', 'sh', 'shell', 'zsh'], shell),
  legacyLanguage('PowerShell', ['ps1', 'powershell', 'pwsh'], powerShell),
  legacyLanguage('Ruby', ['rb', 'ruby'], ruby),
  legacyLanguage('Perl', ['pl', 'pm', 'perl'], perl),
  legacyLanguage('Lua', ['lua'], lua),
  legacyLanguage('SQL', ['sql', 'sqlite', 'postgres', 'postgresql', 'mysql'], standardSQL),
  legacyLanguage('TOML', ['toml'], toml),
  legacyLanguage('Dockerfile', ['dockerfile', 'docker'], dockerFile),
  legacyLanguage('Protocol Buffers', ['proto', 'protobuf'], protobuf),
  legacyLanguage('Groovy', ['groovy'], groovy),
  legacyLanguage('Haskell', ['hs', 'haskell'], haskell),
  legacyLanguage('Julia', ['jl', 'julia'], julia),
  legacyLanguage('R', ['r'], r),
  legacyLanguage('F#', ['fs', 'fsi', 'fsscript', 'fsharp'], fSharp)
];

const writerHighlightStyle = HighlightStyle.define([
  { tag: tags.content, color: '#abb2bf' },
  { tag: [tags.processingInstruction, tags.contentSeparator, tags.list], color: '#6f8f7b' },
  { tag: tags.heading1, color: '#8cf0ae', fontWeight: '700' },
  { tag: tags.heading2, color: '#79dba2', fontWeight: '700' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], color: '#b7c4bd', fontWeight: '700' },
  { tag: tags.link, color: '#9cc9e8', textDecoration: 'underline' },
  { tag: tags.url, color: '#79dba2' },
  { tag: tags.emphasis, color: '#e5c07b', fontStyle: 'italic' },
  { tag: tags.strong, color: '#dbe7df', fontWeight: '700' },
  { tag: tags.strikethrough, color: '#87978d', textDecoration: 'line-through' },
  { tag: tags.quote, color: '#9bd6af', fontStyle: 'italic' },
  { tag: tags.monospace, color: '#a9e6ba' },
  { tag: [tags.comment, tags.docComment], color: '#6f8f7b', fontStyle: 'italic' },
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword], color: '#c678dd' },
  { tag: [tags.operatorKeyword, tags.operator], color: '#56b6c2' },
  { tag: [tags.deleted, tags.character, tags.macroName], color: '#e06c75' },
  { tag: [tags.propertyName, tags.attributeName], color: '#e06c75' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.labelName], color: '#61afef' },
  { tag: [tags.definition(tags.name), tags.definition(tags.variableName), tags.definition(tags.propertyName)], color: '#dbe7df' },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.tagName], color: '#e5c07b' },
  { tag: [tags.standard(tags.name), tags.standard(tags.variableName)], color: '#61afef' },
  { tag: tags.variableName, color: '#dbe7df' },
  { tag: [tags.string, tags.docString, tags.attributeValue, tags.regexp], color: '#98c379' },
  { tag: tags.number, color: '#d19a66' },
  { tag: [tags.bool, tags.atom, tags.null, tags.self], color: '#d19a66' },
  { tag: [tags.punctuation, tags.separator, tags.bracket], color: '#87978d' },
  { tag: [tags.meta, tags.annotation, tags.processingInstruction], color: '#b7c4bd' },
  { tag: tags.invalid, color: '#ff8c8c', textDecoration: 'underline wavy' }
]);

const writerTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: '#abb2bf',
    backgroundColor: '#282c34',
    font: '0.86rem/1.7 ui-monospace, SFMono-Regular, Consolas, monospace'
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit'
  },
  '.cm-content': {
    minHeight: '100%',
    padding: '18px 0'
  },
  '.cm-line': {
    padding: '0 18px'
  },
  '.cm-gutters': {
    color: '#6f8f7b',
    backgroundColor: '#282c34',
    border: 0
  },
  '.cm-activeLine': {
    backgroundColor: '#25352d'
  },
  '.cm-activeLineGutter': {
    color: '#8cf0ae',
    backgroundColor: '#25352d'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#79dba2'
  },
  '&.cm-focused': {
    outline: '1px solid #3c7254',
    outlineOffset: '-1px'
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: '#244b36 !important'
  }
}, { dark: true });

export function createMarkdownEditor({ parent, value = '', wrapLines = false, onChange, onSave }) {
  let suppressChange = false;
  const lineWrapping = new Compartment();

  const view = new EditorView({
    state: EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([...defaultKeymap, indentWithTab]),
        markdown({ codeLanguages }),
        oneDarkTheme,
        syntaxHighlighting(writerHighlightStyle),
        writerTheme,
        lineWrapping.of(wrapLines ? EditorView.lineWrapping : []),
        EditorView.domEventHandlers({
          keydown: (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
              event.preventDefault();
              onSave?.();
              return true;
            }

            return false;
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !suppressChange) onChange?.(update.state.doc.toString());
        })
      ]
    }),
    parent
  });

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (nextValue) => {
      const valueToSet = String(nextValue ?? '');
      if (view.state.doc.toString() === valueToSet) return;

      suppressChange = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: valueToSet } });
      suppressChange = false;
    },
    insertText: (text) => {
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
      view.focus();
    },
    setLineWrapping: (enabled) => view.dispatch({
      effects: lineWrapping.reconfigure(enabled ? EditorView.lineWrapping : [])
    }),
    focus: () => view.focus(),
    destroy: () => view.destroy()
  };
}
