import { useState } from "react";
import "./urlform.css"; 

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
    <form className="url-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="File, URL, IP address, Domain, Hash, or CVE"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <button type="submit">Process</button>
    </form>
  );
};

export default UrlForm;
