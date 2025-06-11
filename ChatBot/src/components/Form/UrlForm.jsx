import { useState } from "react";
import "./UrlForm.css";

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
    <form className="url-form" onSubmit={handleSubmit}>
      <div className="input-container">
        <input
          type="text"
          placeholder="File, URL, IP address, Domain, Hash, or CVE"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="url-input"
        />
        <label className="file-label">
          <input
            type="file"
            onChange={handleFileChange}
            className="file-input"
            accept="*/*"
          />
          <span className="material-symbols-rounded attach-icon">attach_file</span>
        </label>
      </div>
      <button type="submit" className="submit-button">
        Process
      </button>
    </form>
  );
};

export default UrlForm;