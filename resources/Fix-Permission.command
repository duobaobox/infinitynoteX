#!/bin/bash
# Bypass Gatekeeper for InfinityNoteX
echo "------------------------------------------------"
echo "Fixing permissions for InfinityNoteX..."
echo "------------------------------------------------"
sudo xattr -cr /Applications/InfinityNoteX.app
echo "------------------------------------------------"
echo "Done! You can now open InfinityNoteX from Applications."
echo "------------------------------------------------"
read -p "Press enter to exit"
