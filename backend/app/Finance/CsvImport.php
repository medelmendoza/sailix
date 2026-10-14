<?php

namespace App\Finance;

use App\Models\Membership;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Shared engine of the payslip and loan CSV imports (docs/16). An organization's administrator uploads a CSV exported from
 * their payroll system. The file is checked as a WHOLE first: if any row is wrong nothing is imported, and every problem is
 * reported with its line number. Re-importing the same file updates the same records instead of duplicating them.
 *
 * The server never recomputes money (spec BR-48): amounts are stored exactly as the file gives them.
 */
abstract class CsvImport
{
    public const MAX_ROWS = 2000;

    public const MAX_BYTES = 2 * 1024 * 1024;

    private const MAX_ERRORS = 50;

    /** @return list<string> every column the file may have; the first ones are required */
    abstract public function columns(): array;

    /** @return list<string> */
    abstract public function required(): array;

    /** @return array<string, mixed> rules for one row, by column name */
    abstract protected function rules(): array;

    /** @return array<string, string> a one-line example row for the template */
    abstract public function example(): array;

    /**
     * Turns one validated row into what is stored, or null when nothing should be written for it.
     *
     * @param  array<string, string|null>  $row
     * @return array<string, mixed>
     */
    abstract protected function normalize(array $row): array;

    /**
     * Writes one normalized row for a member; returns true when it CREATED a record and false when it UPDATED one.
     *
     * @param  array<string, mixed>  $data
     */
    abstract protected function store(Membership $member, array $data): bool;

    /** @return array{rows: int, created: int, updated: int, errors: list<array{line: int, message: string}>, imported: bool} */
    public function run(UploadedFile $file, bool $commit): array
    {
        $errors = [];
        $parsed = $this->parse($file, $errors);

        $usernames = array_values(array_unique(array_filter(array_map(fn ($r) => mb_strtolower((string) ($r['row']['username'] ?? '')), $parsed))));
        $members = $this->members($usernames);

        $ready = [];
        foreach ($parsed as $entry) {
            ['line' => $line, 'row' => $row] = $entry;
            $v = Validator::make($row, ['username' => ['required', 'string', 'max:100']] + $this->rules());
            if ($v->fails()) {
                $this->addError($errors, $line, $v->errors()->first());

                continue;
            }
            $member = $members[mb_strtolower((string) $row['username'])] ?? null;
            if ($member === null) {
                $this->addError($errors, $line, "No member of your organization has the username \"{$row['username']}\".");

                continue;
            }
            $ready[] = ['line' => $line, 'member' => $member, 'data' => $this->normalize($row)];
        }

        $result = ['rows' => count($parsed), 'created' => 0, 'updated' => 0, 'errors' => array_slice($errors, 0, self::MAX_ERRORS), 'imported' => false];
        if ($errors !== [] || ! $commit) {
            // a check run says what WOULD happen
            if ($errors === []) {
                foreach ($ready as $r) {
                    $this->wouldCreate($r['member'], $r['data']) ? $result['created']++ : $result['updated']++;
                }
            }

            return $result;
        }

        DB::transaction(function () use ($ready, &$result) {
            foreach ($ready as $r) {
                $this->store($r['member'], $r['data']) ? $result['created']++ : $result['updated']++;
            }
        });
        $result['imported'] = true;

        return $result;
    }

    /** @param  array<string, mixed>  $data */
    abstract protected function wouldCreate(Membership $member, array $data): bool;

    /** The CSV a person can fill in: the header and one example row. */
    public function template(): string
    {
        $out = fopen('php://temp', 'r+');
        fputcsv($out, $this->columns());
        fputcsv($out, array_map(fn ($c) => $this->example()[$c] ?? '', $this->columns()));
        rewind($out);

        return (string) stream_get_contents($out);
    }

    /**
     * @param  list<array{line: int, message: string}>  $errors
     * @return list<array{line: int, row: array<string, string|null>}>
     */
    private function parse(UploadedFile $file, array &$errors): array
    {
        $handle = fopen($file->getRealPath(), 'r');
        if ($handle === false) {
            $this->addError($errors, 0, 'The file could not be read.');

            return [];
        }
        $bom = fread($handle, 3);
        if ($bom !== "\xEF\xBB\xBF") {
            rewind($handle);
        }

        $header = fgetcsv($handle, 0, ',', '"', '');
        if ($header === false || $header === [null]) {
            $this->addError($errors, 1, 'The file is empty.');
            fclose($handle);

            return [];
        }
        $header = array_map(fn ($h) => mb_strtolower(trim((string) $h)), $header);

        $unknown = array_diff(array_filter($header), $this->columns());
        if ($unknown !== []) {
            $this->addError($errors, 1, 'Unknown column(s): '.implode(', ', $unknown).'. Use the template.');
        }
        $missing = array_diff($this->required(), $header);
        if ($missing !== []) {
            $this->addError($errors, 1, 'Missing required column(s): '.implode(', ', $missing).'.');
        }
        if ($unknown !== [] || $missing !== []) {
            fclose($handle);

            return [];
        }

        $rows = [];
        $line = 1;
        while (($cells = fgetcsv($handle, 0, ',', '"', '')) !== false) {
            $line++;
            if ($cells === [null] || count(array_filter($cells, fn ($c) => trim((string) $c) !== '')) === 0) {
                continue; // a blank line
            }
            if (count($cells) > count($header) && array_filter(array_slice($cells, count($header)), fn ($c) => trim((string) $c) !== '') !== []) {
                $this->addError($errors, $line, 'This row has more values than the header has columns (a comma inside a value needs quotes around the value).');

                continue;
            }
            if (count($rows) >= self::MAX_ROWS) {
                $this->addError($errors, $line, 'Too many rows: split the file into parts of at most '.self::MAX_ROWS.' rows.');
                break;
            }
            $row = [];
            foreach ($header as $i => $name) {
                if ($name === '') {
                    continue;
                }
                $value = isset($cells[$i]) ? trim((string) $cells[$i]) : '';
                $row[$name] = $value === '' ? null : $value;
            }
            $rows[] = ['line' => $line, 'row' => $row];
        }
        fclose($handle);

        return $rows;
    }

    /**
     * Members of the CALLER'S organization only (the model is tenant-scoped), by username.
     *
     * @param  list<string>  $usernames
     * @return array<string, Membership>
     */
    private function members(array $usernames): array
    {
        if ($usernames === []) {
            return [];
        }
        $out = [];
        Membership::with('user')->whereHas('user', fn ($q) => $q->whereIn('username', $usernames))->get()
            ->each(function (Membership $m) use (&$out) {
                $out[mb_strtolower($m->user->username)] = $m;
            });

        return $out;
    }

    /** @param  list<array{line: int, message: string}>  $errors */
    protected function addError(array &$errors, int $line, string $message): void
    {
        $errors[] = ['line' => $line, 'message' => $message];
    }

    /** yes/no, true/false, 1/0 (any case) to a boolean; anything else is left for validation to refuse. */
    protected function bool(?string $value): bool
    {
        return in_array(mb_strtolower((string) $value), ['yes', 'y', 'true', '1'], true);
    }
}
