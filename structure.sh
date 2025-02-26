#!/bin/bash

# Base source directory - adjust this to your project's root directory
SOURCE_DIR="."
# Base target directory - where to create the new structure
TARGET_DIR="./src"

# Create main directory structure
echo "Creating directory structure..."

# Core application structure
mkdir -p $TARGET_DIR/app/core/auth
mkdir -p $TARGET_DIR/app/core/models
mkdir -p $TARGET_DIR/app/core/services
mkdir -p $TARGET_DIR/app/core/interceptors
mkdir -p $TARGET_DIR/app/core/guards

# Feature modules
mkdir -p $TARGET_DIR/app/features/home
mkdir -p $TARGET_DIR/app/features/login
mkdir -p $TARGET_DIR/app/features/file-management
mkdir -p $TARGET_DIR/app/features/file-management/components/file-generator
mkdir -p $TARGET_DIR/app/features/file-management/components/job-list
mkdir -p $TARGET_DIR/app/features/file-management/components/processing-dialog
mkdir -p $TARGET_DIR/app/features/file-management/components/report-forms
mkdir -p $TARGET_DIR/app/features/file-management/services
mkdir -p $TARGET_DIR/app/features/file-management/models
mkdir -p $TARGET_DIR/app/features/file-management/pipes
mkdir -p $TARGET_DIR/app/features/file-management/utils

# Shared module
mkdir -p $TARGET_DIR/app/shared/models
mkdir -p $TARGET_DIR/app/shared/pipes
mkdir -p $TARGET_DIR/app/shared/components
mkdir -p $TARGET_DIR/app/shared/directives
mkdir -p $TARGET_DIR/app/shared/utils

echo "Directory structure created."
echo "Finding and moving files to their new locations..."

# Function to find and move a file to a destination directory
find_and_move() {
  filename=$1
  destination=$2

  # Find the file and get its path
  file_path=$(find $SOURCE_DIR -name "$filename" -type f | head -n 1)

  if [ -n "$file_path" ]; then
    echo "Moving $file_path to $destination"
    cp "$file_path" "$destination"
  else
    echo "Warning: Could not find file $filename"
  fi
}

# Move auth-related files
find_and_move "auth.service.ts" "$TARGET_DIR/app/core/auth/"
find_and_move "auth.guard.ts" "$TARGET_DIR/app/core/guards/"
find_and_move "auth.interceptor.ts" "$TARGET_DIR/app/core/interceptors/"
find_and_move "auth-config.ts" "$TARGET_DIR/app/core/auth/"

# Move core services
find_and_move "csrf.service.ts" "$TARGET_DIR/app/core/services/"
find_and_move "rx-stomp.service.ts" "$TARGET_DIR/app/core/services/"
find_and_move "csrf.ts" "$TARGET_DIR/app/core/models/"
find_and_move "rx-stomp.config.ts" "$TARGET_DIR/app/core/services/"

# Move app component files
find_and_move "app.component.html" "$TARGET_DIR/app/"
find_and_move "app.component.scss" "$TARGET_DIR/app/"
find_and_move "app.component.ts" "$TARGET_DIR/app/"
find_and_move "app.component.spec.ts" "$TARGET_DIR/app/"
find_and_move "app.config.ts" "$TARGET_DIR/app/"
find_and_move "app.routes.ts" "$TARGET_DIR/app/"

# Move home component
find_and_move "home.component.ts" "$TARGET_DIR/app/features/home/"

# Move login component
find_and_move "login.component.ts" "$TARGET_DIR/app/features/login/"

# Move file management components
find_and_move "file-management.component.html" "$TARGET_DIR/app/features/file-management/"
find_and_move "file-management.component.scss" "$TARGET_DIR/app/features/file-management/"
find_and_move "file-management.component.ts" "$TARGET_DIR/app/features/file-management/"
find_and_move "file-management.routes.ts" "$TARGET_DIR/app/features/file-management/"

# Move file generator components
find_and_move "file-generator.component.html" "$TARGET_DIR/app/features/file-management/components/file-generator/"
find_and_move "file-generator.component.scss" "$TARGET_DIR/app/features/file-management/components/file-generator/"
find_and_move "file-generator.component.ts" "$TARGET_DIR/app/features/file-management/components/file-generator/"
find_and_move "file-generator-form.component.html" "$TARGET_DIR/app/features/file-management/components/file-generator/"
find_and_move "file-generator-form.component.scss" "$TARGET_DIR/app/features/file-management/components/file-generator/"
find_and_move "file-generator-form.component.ts" "$TARGET_DIR/app/features/file-management/components/file-generator/"

# Move job list components
find_and_move "job-list.component.html" "$TARGET_DIR/app/features/file-management/components/job-list/"
find_and_move "job-list.component.scss" "$TARGET_DIR/app/features/file-management/components/job-list/"
find_and_move "job-list.component.ts" "$TARGET_DIR/app/features/file-management/components/job-list/"

# Move processing dialog component
find_and_move "processing-dialog.component.html" "$TARGET_DIR/app/features/file-management/components/processing-dialog/"
find_and_move "processing-dialog.component.scss" "$TARGET_DIR/app/features/file-management/components/processing-dialog/"
find_and_move "processing-dialog.component.ts" "$TARGET_DIR/app/features/file-management/components/processing-dialog/"

# Move report form components
find_and_move "report-form-base.component.ts" "$TARGET_DIR/app/features/file-management/components/report-forms/"
find_and_move "user-activity-report-form.component.ts" "$TARGET_DIR/app/features/file-management/components/report-forms/"
find_and_move "system-health-report-form.component.ts" "$TARGET_DIR/app/features/file-management/components/report-forms/"
find_and_move "file-statistics-report-form.component.ts" "$TARGET_DIR/app/features/file-management/components/report-forms/"
find_and_move "custom-report-form.component.ts" "$TARGET_DIR/app/features/file-management/components/report-forms/"

# Move file generation services
find_and_move "file-generation.service.ts" "$TARGET_DIR/app/features/file-management/services/"
find_and_move "file-generator-api.service.ts" "$TARGET_DIR/app/features/file-management/services/"
find_and_move "job-processing.service.ts" "$TARGET_DIR/app/features/file-management/services/"
find_and_move "job-list-manager.service.ts" "$TARGET_DIR/app/features/file-management/services/"

# Move models and pipes
find_and_move "file-generation.models.ts" "$TARGET_DIR/app/features/file-management/models/"
find_and_move "report-request.models.ts" "$TARGET_DIR/app/features/file-management/models/"
find_and_move "file-type.pipe.ts" "$TARGET_DIR/app/features/file-management/pipes/"
find_and_move "job-status.pipe.ts" "$TARGET_DIR/app/features/file-management/pipes/"
find_and_move "job-status.helpers.ts" "$TARGET_DIR/app/features/file-management/utils/"

echo "Files have been copied to their new locations."
echo "Note: The original files remain in place. Please review the new structure and manually delete the old files when satisfied."
echo "You'll also need to update imports in the files to reflect the new structure."
