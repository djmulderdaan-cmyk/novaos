# RandomOS – hulp-commando's

Open deze pagina op de laptop (bureaubladmodus → browser), klik rechtsboven in een vak op het **kopieer-icoon**
en plak het in **Konsole** met **Ctrl + Shift + V**. Druk daarna op Enter.

## 0. RandomOS updaten (eenmalig met de hand, daarna gaat het vanzelf)

Vraagt om je wachtwoord. De laptop downloadt de update en start daarna vanzelf opnieuw op.

```bash
sudo rpm-ostree upgrade && systemctl reboot
```

## 1. Op afstand laten meekijken (SSH aanzetten)

Zet SSH aan en geeft de hulp-pc toegang. Vraagt één keer om je wachtwoord (je typt blind, dat is normaal).

```bash
sudo systemctl enable --now sshd && mkdir -p ~/.ssh && grep -q randomos-hulp ~/.ssh/authorized_keys 2>/dev/null || echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIE9QJaJ+CHRqpcrBZMi+DQ6XupufXRF6jPOAdoXWUOyH randomos-hulp" >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys; echo "GEBRUIKER: $(whoami)   IP: $(hostname -I | cut -d' ' -f1)"
```

Stuur de regel met **GEBRUIKER** en **IP** door.

## 2. Logboek bekijken

```bash
tail -n 40 ~/.local/state/randomos/shell.log; journalctl --user -b --no-pager | grep -iE "gamescope|randomos|electron|steam" | tail -n 60
```

## 3. Noodknop: Game Mode met de gewone Steam-interface

```bash
mkdir -p ~/.config/randomos && touch ~/.config/randomos/use-steam-ui
```

Weer terug naar RandomOS Shell:

```bash
rm -f ~/.config/randomos/use-steam-ui
```

## 4. Meekijken weer uitzetten

```bash
sudo systemctl disable --now sshd && sed -i '/randomos-hulp/d' ~/.ssh/authorized_keys
```
