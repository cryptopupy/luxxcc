import React from "react";

function highlightLua(code) {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    let highlighted = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    highlighted = highlighted.replace(/(--.*$)/gm, '<span class="lua-comment">$1</span>');
    highlighted = highlighted.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="lua-string">$1</span>');
    highlighted = highlighted.replace(/\b(true|false|nil)\b/g, '<span class="lua-boolean">$1</span>');
    highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="lua-number">$1</span>');
    highlighted = highlighted.replace(
      /\b(local|function|end|if|then|else|elseif|for|while|do|return|and|or|not|in|repeat|until|break)\b/g,
      '<span class="lua-keyword">$1</span>',
    );
    highlighted = highlighted.replace(
      /\b(Color3\.fromRGB|game|shared|loadstring|require|print|warn|error|pcall|xpcall|tonumber|tostring|type|pairs|ipairs|next|select|unpack|rawget|rawset|setmetatable|getmetatable|math\.\w+|string\.\w+|table\.\w+|Instance\.new|game:HttpGet)\b/g,
      '<span class="lua-function">$1</span>',
    );

    return { lineNum: i + 1, html: highlighted };
  });
}

export default function LuaHighlighter({ code, maxHeight = "500px", minHeight = "560px" }) {
  const lines = highlightLua(code || "");

  return (
    <div className="luxx-surface overflow-hidden">
      <div className="overflow-auto" style={{ maxHeight, minHeight }}>
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line) => (
              <tr key={line.lineNum} className="hover:bg-white/[0.01]">
                <td
                  className="select-none border-r border-white/[0.05] bg-[#101521] pl-4 pr-5 text-right font-mono text-xs"
                  style={{
                    color: "#5f6d88",
                    width: "70px",
                    minWidth: "70px",
                    lineHeight: "1.72",
                  }}
                >
                  {line.lineNum}
                </td>
                <td
                  className="whitespace-pre bg-[#131825] pl-5 pr-6 font-mono text-xs"
                  style={{
                    color: "#b7c4dd",
                    lineHeight: "1.72",
                  }}
                  dangerouslySetInnerHTML={{ __html: line.html }}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
