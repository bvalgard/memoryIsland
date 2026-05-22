import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

const REMARK_PLUGINS = [remarkMath];
const REHYPE_PLUGINS = [rehypeRaw, rehypeKatex];

// Inline-only allowed elements — safe to render inside <button>/<span>
const INLINE_ELEMENTS = ['strong', 'em', 'code', 'span', 'a', 'del', 'math', 'inlineMath'];

// Renders **bold** at a heavier weight than the surrounding font-bold parent text
const COMPONENTS = {
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-black">{children}</strong>
  ),
};

interface RichTextProps {
  children: string | undefined | null;
}

export function RichText({ children }: RichTextProps) {
  if (!children) return null;
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={COMPONENTS}
    >
      {children}
    </ReactMarkdown>
  );
}

export function RichTextInline({ children }: RichTextProps) {
  if (!children) return null;
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      allowedElements={INLINE_ELEMENTS}
      unwrapDisallowed
      components={COMPONENTS}
    >
      {children}
    </ReactMarkdown>
  );
}
