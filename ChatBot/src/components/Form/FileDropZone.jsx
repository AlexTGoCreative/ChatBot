import React, { useState, useEffect } from "react";

const FileDropZone = ({ onFileDrop }) => {
  const [dragCounter, setDragCounter] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter((prev) => prev + 1);
      setIsDragging(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter((prev) => {
        const newCount = prev - 1;
        if (newCount <= 0) {
          setIsDragging(false);
          return 0;
        }
        return newCount;
      });
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setDragCounter(0);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFileDrop(files);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [onFileDrop]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, width: "100%", height: "100%",
        zIndex: 1000,
        pointerEvents: isDragging ? "auto" : "none",
        backgroundColor: isDragging ? "rgba(0,0,0,0.4)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background-color 0.2s ease-in-out",
      }}
    >
      {isDragging && (
        <div
          style={{
            padding: "40px 80px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            boxShadow: "0 0 20px rgba(0,0,0,0.2)",
            fontSize: "20px",
            fontWeight: "bold",
          }}
        >
          🗂️ Drag the file here to upload it
        </div>
      )}
    </div>
  );
};

export default FileDropZone;
