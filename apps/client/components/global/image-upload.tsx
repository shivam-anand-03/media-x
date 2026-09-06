// image-upload.tsx
"use client";

import * as React from "react";
import { Upload, User, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";

interface ImageUploadProps {
  value?: File | string | null;
  onChange?: (file: File | null) => void;
  className?: string;

  placeholder?: string;
  defaultImage?: string | null;

  shape?: "circle" | "square";
  disabled?: boolean;
  loading?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  className,
  placeholder = "Drag & drop image here",
  defaultImage,
  shape = "circle",
  disabled = false,
  loading = false,
}: ImageUploadProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const [preview, setPreview] = React.useState<string | null>(
    defaultImage || null,
  );

  React.useEffect(() => {
    if (!value) {
      setPreview(defaultImage || null);
      return;
    }

    // URL string from API
    if (typeof value === "string") {
      setPreview(value);
      return;
    }

    // Local file preview
    const objectUrl = URL.createObjectURL(value);
    setPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [value, defaultImage]);

  const handleFile = (file: File | null) => {
    if (!file) return;

    onChange?.(file);
  };

  const handleRemove = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    setPreview(null);
    onChange?.(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const rounded = shape === "circle" ? "rounded-full" : "rounded-3xl";

  return (
    <div className={cn("flex justify-center", className)}>
      <div
        onClick={() => !disabled && !loading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();

          const file = e.dataTransfer.files?.[0];

          if (file && file.type.startsWith("image/")) {
            handleFile(file);
          }
        }}
        className={cn(
          "relative flex h-52 w-52 items-center justify-center overflow-hidden border-2 border-dashed transition-all",
          rounded,
          {
            "cursor-pointer border-muted bg-muted/20 hover:border-primary":
              !disabled && !loading,

            "cursor-not-allowed opacity-60": disabled || loading,
          },
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || loading}
          onChange={(e) => {
            const file = e.target.files?.[0];

            if (file) {
              handleFile(file);
            }
          }}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- transient object/data URL preview; next/image adds no value for uploads */}
            <img
              src={preview}
              alt="preview"
              className="h-full w-full object-cover"
            />

            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={handleRemove}
              className="absolute right-2 top-2 h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border bg-background shadow-sm">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>

            <p className="max-w-40 text-sm font-medium">{placeholder}</p>

            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Upload className="h-4 w-4" />
              Click to upload
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
