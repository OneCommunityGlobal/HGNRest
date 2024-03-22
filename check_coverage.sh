#!/bin/bash

# Read the HTML file and extract the first four percentage values
percentages=$(awk -F'[<>]' '/strong/{print $3}' coverage/lcov-report/index.html | head -n 4)

# Initialize variables for sum and count
sum=0
count=0

# Loop through each percentage value and calculate the sum
for percentage in $percentages; do
    sum=$(echo "$sum + ${percentage%\%}" | bc)
    ((count++))
done

# Calculate the average
COVERAGE_PERCENTAGE=$(echo "scale=2; $sum / $count" | bc)

# Define the threshold percentage
THRESHOLD_PERCENTAGE=70

# Print the average
echo "Average of the Stmts, Funcs and Lines percentages: $COVERAGE_PERCENTAGE%"

# Check if the coverage percentage is below the threshold
if (( $(echo "$COVERAGE_PERCENTAGE < $THRESHOLD_PERCENTAGE" | bc -l) )); then
  echo "Coverage percentage is below threshold ($THRESHOLD_PERCENTAGE%)."
  exit 1
fi