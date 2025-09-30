import { useState } from "react";
import "./UrlForm.css";

const UrlForm = ({ onSubmit, isScanning }) => {
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isScanning) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && !isScanning) {
      onSubmit(file);
      e.target.value = null; 
    }
  };

  return (
    <form className={`url-form ${isScanning ? 'scanning' : ''}`} onSubmit={handleSubmit}>
      <div className="input-container">
        <input
          type="text"
          placeholder="File, URL, IP address, Domain, Hash, or CVE"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="url-input"
          disabled={isScanning}
        />
        <label className="file-label">
          <input
            type="file"
            onChange={handleFileChange}
            className="file-input"
            accept="*/*"
            disabled={isScanning}
          />
          <span className="material-symbols-rounded attach-icon">attach_file</span>
        </label>
      </div>
      <button type="submit" className="submit-button" disabled={isScanning}>
        {isScanning ? 'Processing...' : 'Process'}
      </button>
    </form>
  );
};

export default UrlForm;