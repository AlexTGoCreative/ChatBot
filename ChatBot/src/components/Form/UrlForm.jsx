import { useState } from "react";

const UrlForm = ({ onSubmit }) => {
  const [input, setInput] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  return (
    <form className="url-form flex justify-center items-center mt-[80px] gap-0" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="File, URL, IP address, Domain, Hash, or CVE"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-[500px] px-[16px] py-[12px] text-[0.95rem] border-[1px] border-[solid] border-[#ccc] rounded-tl-[8px] rounded-br-[0] rounded-tr-[0] rounded-bl-[8px] outline-[none] [transition:border_0.2s_ease] focus:border-[#2563eb] focus:[box-shadow:0_0_0_2px_rgba(37,_99,_235,_0.2)]"
      />
      <button
        type="submit"
        className="bg-[#2563eb] text-[white] font-medium px-[20px] py-[12px] text-[0.95rem] cursor-pointer rounded-tl-[0] rounded-br-[8px] rounded-tr-[8px] rounded-bl-[0] [transition:background-color_0.2s_ease] hover:bg-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-opacity-50 border-none"
      >
        Process
      </button>
    </form>
  );

};

export default UrlForm;
