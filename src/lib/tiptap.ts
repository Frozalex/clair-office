import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
export const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, defaultProtocol: "https" },
  }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Image.configure({ allowBase64: true }),
  TableKit.configure({ table: { resizable: true } }),
  Placeholder.configure({
    placeholder: "Une idée, une phrase… à vous d’écrire.",
  }),
  Highlight,
];
