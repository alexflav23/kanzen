import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { ListNode, ListItemNode, INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from "@lexical/list";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $getRoot, $insertNodes, FORMAT_TEXT_COMMAND, type LexicalEditor } from "lexical";
import { colors, radius } from "../styles/tokens.stylex";
import { Mail } from "./icons";

const cx = (s: stylex.StyleXStyles) => stylex.props(s).className ?? "";

/** W9.4 — the rich-text reply composer (Lexical). Produces HTML; auto-saves a shared draft; sends from the thread's
 *  inbox. Themed via the StyleX token classes so it matches warm-paper light + dark. */
export function ReplyComposer(props: {
  initialHtml: string;
  onSaveDraft: (html: string) => void;
  onSend: (html: string) => void;
  sending: boolean;
  onCancel: () => void;
}) {
  const editorRef = useRef<LexicalEditor | null>(null);
  const htmlRef = useRef(props.initialHtml);
  const [isEmpty, setIsEmpty] = useState(props.initialHtml.replace(/<[^>]*>/g, "").trim().length === 0);

  return (
    <div {...stylex.props(styles.wrap)} data-testid="reply-composer">
      <LexicalComposer
        initialConfig={{
          namespace: "kanzen-reply",
          theme: {
            paragraph: cx(styles.paragraph),
            text: { bold: cx(styles.bold), italic: cx(styles.italic), underline: cx(styles.underline) },
            list: { ul: cx(styles.ul), ol: cx(styles.ol), listitem: cx(styles.li) },
            link: cx(styles.link),
          },
          nodes: [ListNode, ListItemNode, LinkNode],
          onError: (e) => { throw e; },
        }}
      >
        <Toolbar />
        <div {...stylex.props(styles.editorWrap)}>
          <RichTextPlugin
            contentEditable={<ContentEditable aria-label="Reply" className={cx(styles.editor)} />}
            placeholder={<div {...stylex.props(styles.placeholder)}>Write a reply…</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <CapturePlugin editorRef={editorRef} />
        <LoadInitial html={props.initialHtml} />
        <OnChangePlugin
          onChange={(state, editor) => {
            // read with { editor } so $generateHtmlFromNodes has an active editor (Lexical 0.45)
            state.read(() => {
              setIsEmpty($getRoot().getTextContent().trim().length === 0);
              const next = $generateHtmlFromNodes(editor);
              htmlRef.current = next;
              props.onSaveDraft(next);
            }, { editor });
          }}
        />
      </LexicalComposer>

      <div {...stylex.props(styles.footer)}>
        <button type="button" {...stylex.props(styles.ghost)} onClick={props.onCancel}>Cancel</button>
        <button
          type="button"
          {...stylex.props(styles.send)}
          disabled={isEmpty || props.sending}
          data-testid="reply-send"
          onClick={() => {
            props.onSend(htmlRef.current);
            editorRef.current?.update(() => $getRoot().clear());
          }}
        >
          <Mail size={14} /> Send
        </button>
      </div>
    </div>
  );
}

/** Captures the editor instance so the Send button (outside the Lexical context) can clear it after sending. */
function CapturePlugin({ editorRef }: { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => { editorRef.current = editor; }, [editor, editorRef]);
  return null;
}

/** Loads the shared draft's HTML into the editor once on mount. */
function LoadInitial({ html }: { html: string }) {
  const [editor] = useLexicalComposerContext();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !html.trim()) return;
    done.current = true;
    editor.update(() => {
      const dom = new DOMParser().parseFromString(html, "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);
      const root = $getRoot();
      root.clear();
      root.selectEnd();
      $insertNodes(nodes);
    });
  }, [editor, html]);
  return null;
}

function Toolbar() {
  const [editor] = useLexicalComposerContext();
  const fmt = (cmd: typeof FORMAT_TEXT_COMMAND, v: "bold" | "italic" | "underline") => () => editor.dispatchCommand(cmd, v);
  const link = () => editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
  return (
    <div {...stylex.props(styles.toolbar)} role="toolbar" aria-label="Formatting">
      <button type="button" {...stylex.props(styles.tbtn, styles.tbold)} aria-label="Bold" onClick={fmt(FORMAT_TEXT_COMMAND, "bold")}>B</button>
      <button type="button" {...stylex.props(styles.tbtn, styles.titalic)} aria-label="Italic" onClick={fmt(FORMAT_TEXT_COMMAND, "italic")}>i</button>
      <button type="button" {...stylex.props(styles.tbtn, styles.tunder)} aria-label="Underline" onClick={fmt(FORMAT_TEXT_COMMAND, "underline")}>U</button>
      <span {...stylex.props(styles.tsep)} aria-hidden="true" />
      <button type="button" {...stylex.props(styles.tbtn)} aria-label="Bullet list" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>•</button>
      <button type="button" {...stylex.props(styles.tbtn)} aria-label="Numbered list" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>1.</button>
      <button type="button" {...stylex.props(styles.tbtn)} aria-label="Insert link" onClick={link}>↗</button>
    </div>
  );
}

const styles = stylex.create({
  wrap: { border: `1px solid ${colors.line}`, borderRadius: radius.md, backgroundColor: colors.bgElev, overflow: "hidden" },
  toolbar: { display: "flex", alignItems: "center", gap: "2px", padding: "6px 8px", borderBottom: `1px solid ${colors.line}`, backgroundColor: colors.bgSunken },
  tbtn: { minWidth: "26px", height: "26px", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px", border: 0, borderRadius: radius.sm, background: "transparent", color: colors.ink2, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", ":hover": { backgroundColor: colors.bgElev } },
  tbold: { fontWeight: 800 },
  titalic: { fontStyle: "italic", fontFamily: "serif" },
  tunder: { textDecoration: "underline" },
  tsep: { width: "1px", height: "16px", backgroundColor: colors.line, margin: "0 4px" },
  editorWrap: { position: "relative" },
  editor: { minHeight: "84px", maxHeight: "240px", overflowY: "auto", padding: "10px 12px", fontSize: "13.5px", lineHeight: 1.55, color: colors.ink, outline: "none" },
  placeholder: { position: "absolute", top: "10px", left: "12px", fontSize: "13.5px", color: colors.ink4, pointerEvents: "none" },
  paragraph: { margin: 0, marginBottom: "6px" },
  bold: { fontWeight: 700 },
  italic: { fontStyle: "italic" },
  underline: { textDecoration: "underline" },
  ul: { paddingLeft: "20px", margin: "4px 0", listStyleType: "disc" },
  ol: { paddingLeft: "20px", margin: "4px 0", listStyleType: "decimal" },
  li: { marginBottom: "2px" },
  link: { color: colors.accent, textDecoration: "underline" },
  footer: { display: "flex", justifyContent: "flex-end", gap: "8px", padding: "8px 10px", borderTop: `1px solid ${colors.line}`, backgroundColor: colors.bgSunken },
  ghost: { padding: "7px 13px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px", fontFamily: "inherit" },
  send: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "12.5px", fontWeight: 500, fontFamily: "inherit" },
});
