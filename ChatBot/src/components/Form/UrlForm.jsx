import { useState } from "react";

const UrlForm = ({ onSubmit }) => {
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onSubmit(file);
      e.target.value = null; 
    }
  };

  return (
    <form className="url-form flex justify-center items-center mt-[80px] gap-2 select-none" onSubmit={handleSubmit}>
      <div className="relative">
        <input
  type="text"
  placeholder="File, URL, IP address, Domain, Hash, or CVE"
  value={input}
  onChange={(e) => setInput(e.target.value)}
  className="w-[500px] px-[16px] py-[12px] pr-[50px] text-[0.95rem] border-[1px] border-[solid] border-[#ccc] rounded-l-[8px] rounded-r-none outline-[none] [transition:border_0.2s_ease] focus:border-[#2563eb] focus:[box-shadow:0_0_0_2px_rgba(37,_99,_235,_0.2)]"
/>

        <label className="absolute right-[12px] top-1/2 transform -translate-y-1/2 cursor-pointer text-[#2563eb] [transition:color_0.2s_ease] hover:text-[#1e40af]">
          <input
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept="*/*"
          />
          <span className="material-symbols-rounded text-[20px] transform rotate-45">attach_file</span>
        </label>
      </div>
      <button
        type="submit"
        className="bg-[#2563eb] text-[white] font-medium px-[20px] py-[12px] text-[0.95rem] cursor-pointer rounded-r-[8px] [transition:background-color_0.2s_ease] hover:bg-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-opacity-50 border-none"
      >
        Process
      </button>
    </form>
  );
};

export default UrlForm;