#!/bin/bash

exclusions=('./SUMMARY.md' './release-notes/template' '.gitbook')
allFiles=$(find . -name '*.md' | sort -d)
missingFiles=()

for file in $allFiles; do
  missing=1
  for exclusion in ${exclusions[@]}; do
    if [[ $file == *$exclusion* ]]; then
      missing=0
    elif grep -q ${file:2} 'SUMMARY.md'; then
      missing=0
    fi
  done
  if [ $missing -eq 1 ]; then
    missingFiles=("${missingFiles[@]}" $file)
  fi
done

if [ ${#missingFiles[@]} -eq 0 ]; then
  echo 'Success. SUMMARY.md is not missing any references.'
else
  echo 'Problems found. SUMMARY.md is missing reference to:'
fi

for file in "${missingFiles[@]}"; do
  reference=${file:2}
  if ! grep -q $reference 'SUMMARY.md'; then
    firstLine=$(head -n 1 $file)
    trim1=${firstLine#*\#}
    trim2=${trim1#* }
    echo '['$trim2']('$reference')'
  fi
done
